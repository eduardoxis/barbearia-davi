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
  const { collection, getDocs, query, where, orderBy, db } = window._fb;

  let resultados = [];
  try {
    const q = query(
      collection(db, 'agendamentos'),
      where('email', '==', email),
      orderBy('criadoEm', 'desc')
    );
    const snap = await getDocs(q);
    snap.forEach(d => resultados.push({ id: d.id, ...d.data() }));
  } catch (e) {
    // sem índice — tenta sem orderBy
    try {
      const q2 = query(collection(db, 'agendamentos'), where('email', '==', email));
      const snap2 = await getDocs(q2);
      snap2.forEach(d => resultados.push({ id: d.id, ...d.data() }));
      resultados.sort((a, b) => (b.criadoEm || '') > (a.criadoEm || '') ? 1 : -1);
    } catch (e2) { /* ignora */ }
  }

  if (!resultados.length && nome) {
    try {
      const q3 = query(collection(db, 'agendamentos'), where('cliente', '==', nome));
      const snap3 = await getDocs(q3);
      snap3.forEach(d => resultados.push({ id: d.id, ...d.data() }));
    } catch (e3) { /* ignora */ }
  }

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
  const { doc, setDoc, collection, db } = window._fb;

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
  const id = 'sol_' + Date.now();

  await setDoc(doc(db, 'solicitacoes', id), {
    id, tipo: 'remarcacao', status: 'aprovado',
    cliente:       agendamento.cliente,
    telefone:      agendamento.telefone,
    servicos:      agendamento.servicos,
    total:         agendamento.total,
    dataOriginal:  agendamento.data,
    horarioOriginal: agendamento.horario,
    novaData,
    novoHorario,
    remarcacoesTotal: novasFeitas,
    prazoValidado: true,
    termoAceito:   true,
    motivo:        motivo || '',
    criadoEm:      new Date().toISOString(),
    criadoEmFormatado: new Date().toLocaleString('pt-BR'),
  });

  // Atualiza horários
  if (agendamento.barbeiroId) {
    liberarHorarioBarbeiro(agendamento.barbeiroId, agendamento.horario);
    bloquearHorarioBarbeiro(agendamento.barbeiroId, novoHorario);
  } else {
    adminSettings.takenSlots = adminSettings.takenSlots.filter(h => h !== agendamento.horario);
    if (!adminSettings.takenSlots.includes(novoHorario)) adminSettings.takenSlots.push(novoHorario);
  }

  await setDoc(doc(db, 'settings', 'admin'), { takenSlots: adminSettings.takenSlots }, { merge: true });

  return { novasFeitas, maxRemarc };
}

/* ── Verificar prazo 24h ── */
export function verificarPrazo24h(dataStr, horarioStr) {
  if (!dataStr || !horarioStr) return false;
  const partes = dataStr.split('/');
  const [hora, min] = (horarioStr + ':00').split(':');
  const dtAtend = new Date(partes[2], partes[1]-1, partes[0], parseInt(hora), parseInt(min || 0));
  return (dtAtend - new Date()) / (1000 * 60 * 60) >= 24;
}
