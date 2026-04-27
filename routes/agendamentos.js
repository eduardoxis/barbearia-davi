/* ══════════════════════════════════════════
   ROUTES/AGENDAMENTOS.JS
   Criar, editar, cancelar e remarcar horários
   Barbearia do Davi
══════════════════════════════════════════ */

import { adminSettings, showToast } from '../js/global.js';
import { liberarHorarioBarbeiro, bloquearHorarioBarbeiro } from './barbeiros.js';

/* ── Cria agendamento no Firestore ── */
export async function criarAgendamento(dados) {
  if (!window._fb) throw new Error('Firebase não disponível.');
  const { collection, addDoc, db } = window._fb;

  const agendamento = {
    cliente:       dados.cliente,
    telefone:      dados.telefone,
    email:         dados.email || '',
    servicos:      dados.servicos,
    total:         dados.total,
    data:          dados.data,
    horario:       dados.horario,
    barbeiro:      dados.barbeiro || '',
    barbeiroId:    dados.barbeiroId || '',
    formaPagamento:'PIX',
    status:        'confirmado',
    pedidoId:      dados.pedidoId || '',
    termoAceito:   dados.termoAceito || false,
    termoAceitoEm: dados.termoAceitoEm || '',
    remarcacoes:   0,
    criadoEm:      new Date().toISOString(),
  };

  const ref = await addDoc(collection(db, 'agendamentos'), agendamento);
  return { id: ref.id, ...agendamento };
}

/* ── Busca agendamentos por email ou nome ── */
export async function buscarAgendamentosCliente(email, nome) {
  if (!window._fb) return [];
  const { collection, getDocsFromServer, getDocs, query, where, db } = window._fb;
  // Sempre busca direto do servidor — ignora cache local do SDK
  const fetchDocs = getDocsFromServer || getDocs;

  const mapaId = new Map(); // deduplicação por ID

  const adicionarResultados = (snap) => {
    snap.forEach(d => {
      if (!mapaId.has(d.id)) mapaId.set(d.id, { id: d.id, ...d.data() });
    });
  };

  // 1. Busca por email
  if (email) {
    try {
      const snap = await fetchDocs(query(collection(db, 'agendamentos'), where('email', '==', email)));
      adicionarResultados(snap);
    } catch (e) { console.warn('[HIST] busca por email falhou:', e.message); }
  }

  // 2. Busca por nome (cliente)
  if (nome) {
    try {
      const snap = await fetchDocs(query(collection(db, 'agendamentos'), where('cliente', '==', nome)));
      adicionarResultados(snap);
    } catch (e) { console.warn('[HIST] busca por nome falhou:', e.message); }
  }

  // 3. Busca por telefone (fallback extra)
  const telefone = window.fbUser?.phone || window.fbUser?.telefone || '';
  if (telefone) {
    try {
      const snap = await fetchDocs(query(collection(db, 'agendamentos'), where('telefone', '==', telefone)));
      adicionarResultados(snap);
    } catch (e) { /* ignora */ }
  }

  const resultados = Array.from(mapaId.values());
  resultados.sort((a, b) => (b.criadoEm || '') > (a.criadoEm || '') ? 1 : -1);
  return resultados;
}

/* ── Busca agendamentos de uma data específica ── */
export async function buscarAgendamentosDoDia(data) {
  if (!window._fb) return [];
  const { collection, getDocs, query, where, db } = window._fb;
  try {
    const q = query(collection(db, 'agendamentos'), where('data', '==', data));
    const snap = await getDocs(q);
    const lista = [];
    snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
    return lista;
  } catch (e) {
    return [];
  }
}

/* ── Busca todos os agendamentos (admin) ── */
export async function buscarTodosAgendamentos() {
  if (!window._fb) return [];
  const { collection, getDocs, query, orderBy, db } = window._fb;
  try {
    const q = query(collection(db, 'agendamentos'), orderBy('criadoEm', 'desc'));
    const snap = await getDocs(q);
    const lista = [];
    snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
    return lista;
  } catch (e) {
    // sem índice
    const snap = await getDocs(collection(db, 'agendamentos'));
    const lista = [];
    snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
    lista.sort((a, b) => (b.criadoEm || '') > (a.criadoEm || '') ? 1 : -1);
    return lista;
  }
}

/* ── Cancela agendamento ── */
export async function cancelarAgendamento(agendamentoId) {
  if (!window._fb) throw new Error('Firebase não disponível.');
  const { doc, setDoc, db } = window._fb;
  await setDoc(doc(db, 'agendamentos', agendamentoId), { status: 'cancelado' }, { merge: true });
}

/* ── Confirma remarcação ── */
export async function confirmarRemarcacao({ agendamento, novaData, novoHorario, motivo }) {
  if (!window._fb) throw new Error('Firebase não disponível.');
  const { doc, setDoc, deleteDoc, addDoc, collection, db } = window._fb;

  const pol = adminSettings.politicaReembolso || {};
  const maxRemarc = pol.maxRemarcacoes ?? 2;
  const feitas = agendamento.remarcacoes || 0;

  if (feitas >= maxRemarc) throw new Error(`Limite de ${maxRemarc} remarcação(ões) atingido.`);

  // Verifica prazo 24h
  const partes = agendamento.data.split('/');
  const [hora] = (agendamento.horario + ':00').split(':');
  const dtAtend = new Date(partes[2], partes[1]-1, partes[0], parseInt(hora));
  const diffHoras = (dtAtend - new Date()) / (1000 * 60 * 60);
  if (diffHoras < 24) throw new Error('Não é possível remarcar: faltam menos de 24 horas.');

  const novasFeitas = feitas + 1;
  const solId = 'sol_' + Date.now();

  // 1. Registra a solicitação de remarcação (log histórico interno)
  await setDoc(doc(db, 'solicitacoes', solId), {
    id: solId, tipo: 'remarcacao', status: 'aprovado',
    cliente:           agendamento.cliente,
    telefone:          agendamento.telefone,
    servicos:          agendamento.servicos,
    total:             agendamento.total,
    dataOriginal:      agendamento.data,
    horarioOriginal:   agendamento.horario,
    agendamentoIdOriginal: agendamento.id || '',
    novaData,
    novoHorario,
    remarcacoesTotal:  novasFeitas,
    prazoValidado:     true,
    termoAceito:       true,
    motivo:            motivo || '',
    criadoEm:          new Date().toISOString(),
    criadoEmFormatado: new Date().toLocaleString('pt-BR'),
  });

  // 2. Remove o agendamento antigo do Firestore (libera do histórico)
  if (agendamento.id) {
    await deleteDoc(doc(db, 'agendamentos', agendamento.id));
  }

  // 3. Cria novo agendamento com o novo horário
  const novoAgendamento = {
    cliente:        agendamento.cliente,
    telefone:       agendamento.telefone,
    email:          agendamento.email || '',
    servicos:       agendamento.servicos,
    total:          agendamento.total,
    data:           novaData,
    horario:        novoHorario,
    barbeiro:       agendamento.barbeiro || '',
    barbeiroId:     agendamento.barbeiroId || '',
    formaPagamento: agendamento.formaPagamento || 'PIX',
    status:         'confirmado',
    pedidoId:       agendamento.pedidoId || '',
    termoAceito:    agendamento.termoAceito || false,
    termoAceitoEm:  agendamento.termoAceitoEm || '',
    remarcacoes:    novasFeitas,
    criadoEm:       new Date().toISOString(),
  };
  const novoRef = await addDoc(collection(db, 'agendamentos'), novoAgendamento);
  const novoId = novoRef.id;

  // 4. Libera slot antigo e bloqueia slot novo
  if (agendamento.barbeiroId) {
    liberarHorarioBarbeiro(agendamento.barbeiroId, agendamento.horario);
    bloquearHorarioBarbeiro(agendamento.barbeiroId, novoHorario);
    await setDoc(doc(db, 'settings', 'admin'), { barbeiros: adminSettings.barbeiros || [] }, { merge: true });
  } else {
    adminSettings.takenSlots = adminSettings.takenSlots.filter(h => h !== agendamento.horario);
    if (!adminSettings.takenSlots.includes(novoHorario)) adminSettings.takenSlots.push(novoHorario);
    await setDoc(doc(db, 'settings', 'admin'), { takenSlots: adminSettings.takenSlots }, { merge: true });
  }

  return { novasFeitas, maxRemarc, novoId };
}

/* ── Verificar prazo 24h ── */
export function verificarPrazo24h(dataStr, horarioStr) {
  if (!dataStr || !horarioStr) return false;
  const partes = dataStr.split('/');
  const [hora, min] = (horarioStr + ':00').split(':');
  const dtAtend = new Date(partes[2], partes[1]-1, partes[0], parseInt(hora), parseInt(min || 0));
  return (dtAtend - new Date()) / (1000 * 60 * 60) >= 24;
}
