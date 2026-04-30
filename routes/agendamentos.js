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
    // Liga ao agendamento substituído — ativa deduplicação por substituiId
    substituiId:   dados.substituiId || '',
    criadoEm:      new Date().toISOString(),
  };

  const ref = await addDoc(collection(db, 'agendamentos'), agendamento);
  return { id: ref.id, ...agendamento };
}

/* ── Busca agendamentos por email ou nome ── */
export async function buscarAgendamentosCliente(email, nome) {
  if (!window._fb) return [];
  const { collection, getDocsFromServer, getDocs, query, where, db } = window._fb;
  const fetchDocs = getDocsFromServer || getDocs;

  // Coleta TODOS os documentos primeiro (sem filtrar status ainda)
  const mapaId = new Map();
  const adicionar = (snap) => snap.forEach(d => {
    if (!mapaId.has(d.id)) mapaId.set(d.id, { id: d.id, ...d.data() });
  });

  if (email) {
    try { adicionar(await fetchDocs(query(collection(db, 'agendamentos'), where('email', '==', email)))); }
    catch (e) { console.warn('[HIST] busca por email falhou:', e.message); }
  }
  if (nome) {
    try { adicionar(await fetchDocs(query(collection(db, 'agendamentos'), where('cliente', '==', nome)))); }
    catch (e) { console.warn('[HIST] busca por nome falhou:', e.message); }
  }
  const telefone = window.fbUser?.phone || window.fbUser?.telefone || '';
  if (telefone) {
    try { adicionar(await fetchDocs(query(collection(db, 'agendamentos'), where('telefone', '==', telefone)))); }
    catch (_) {}
  }

  // Deduplicacao dupla (robusta contra race conditions de propagacao do Firebase)
  // Camada 1: filtra por status (remarcado/reagendado)
  // Camada 2: filtra pelo campo substituiId — o novo agendamento salva o ID do antigo.
  //   Mesmo que o status nao propagou ainda, o link ja existe no novo doc.
  const STATUS_OCULTOS = new Set(['remarcado', 'reagendado', 'cancelado_pelo_sistema']);
  const idsSubstituidos = new Set();
  for (const a of mapaId.values()) {
    if (a.substituiId) idsSubstituidos.add(a.substituiId);
  }

  return Array.from(mapaId.values())
    .filter(a => !STATUS_OCULTOS.has(a.status || '') && !idsSubstituidos.has(a.id))
    .sort((a, b) => (b.criadoEm || '') > (a.criadoEm || '') ? 1 : -1);
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
  const { doc, setDoc, collection, db, writeBatch } = window._fb;

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
  const agora = new Date().toISOString();
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
    criadoEm:          agora,
    criadoEmFormatado: new Date().toLocaleString('pt-BR'),
  });

  // 2. Batch atômico: marca antigo como 'remarcado' E cria novo num único commit.
  //    Se qualquer parte falhar, nenhuma alteração persiste no Firestore.
  //    Isso elimina a race condition que causava duplicidade no histórico.
  const batch = writeBatch(db);

  // 2a. Prepara ref para o NOVO agendamento (ID gerado antes do commit)
  const novoRef = doc(collection(db, 'agendamentos'));
  const novoId = novoRef.id;

  // 2b. Marca o ANTIGO como 'remarcado' (não deletar para manter rastreabilidade)
  if (agendamento.id) {
    batch.update(doc(db, 'agendamentos', agendamento.id), {
      status:         'remarcado',
      remarcadoEm:    agora,
      substituídoPor: novoId,
    });
  }

  // 2c. Cria o NOVO agendamento com referência explícita ao antigo
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
    // Referência explícita — deduplicação camada 2 (substituiId) sempre presente
    substituiId:    agendamento.id || '',
    criadoEm:       agora,
  };
  batch.set(novoRef, novoAgendamento);

  // Commit único — antigo+novo mudam juntos ou nenhum muda
  await batch.commit();

  // 3. Libera slot antigo e bloqueia slot novo
  if (agendamento.barbeiroId) {
    liberarHorarioBarbeiro(agendamento.barbeiroId, agendamento.horario);
    bloquearHorarioBarbeiro(agendamento.barbeiroId, novoHorario);
  }
  adminSettings.takenSlots = (adminSettings.takenSlots || []).filter(h => h !== agendamento.horario);
  if (!adminSettings.takenSlots.includes(novoHorario)) adminSettings.takenSlots.push(novoHorario);
  await setDoc(doc(db, 'settings', 'admin'), {
    barbeiros:  adminSettings.barbeiros  || [],
    takenSlots: adminSettings.takenSlots,
  }, { merge: true });

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
