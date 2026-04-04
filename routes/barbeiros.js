/* ══════════════════════════════════════════
   ROUTES/BARBEIROS.JS — Barbeiros & Horários
   Barbearia do Davi
══════════════════════════════════════════ */

import { adminSettings } from '../js/global.js';

/* ── Gera horários automáticos para um barbeiro ── */
export function gerarHorariosBarbeiro(barbeiro) {
  const slots = [];
  if (!barbeiro.horarioInicio || !barbeiro.horarioFim) return slots;
  const [hI, mI] = barbeiro.horarioInicio.split(':').map(Number);
  const [hF, mF] = barbeiro.horarioFim.split(':').map(Number);
  let t = hI * 60 + mI;
  const fim = hF * 60 + mF;
  const intervalo = parseInt(barbeiro.intervalo) || 60;
  while (t + intervalo <= fim) {
    const hh = String(Math.floor(t / 60)).padStart(2, '0');
    const mm = String(t % 60).padStart(2, '0');
    slots.push(hh + ':' + mm);
    t += intervalo;
  }
  return slots;
}

/* ── Lista barbeiros ativos ── */
export function buscarBarbeiros() {
  return (adminSettings.barbeiros || []).filter(b => b.ativo !== false);
}

/* ── Busca horários disponíveis de um barbeiro em uma data ── */
export function buscarHorariosDisponiveis(barbeiroId, dataStr) {
  const barbeiro = (adminSettings.barbeiros || []).find(b => b.id === barbeiroId);
  if (!barbeiro) return [];

  const slots = gerarHorariosBarbeiro(barbeiro);
  const ocupados = barbeiro.takenSlots || [];

  // Verifica se a data é um dia de trabalho do barbeiro
  if (dataStr) {
    const parts = dataStr.split('/');
    if (parts.length === 3) {
      const dt = new Date(parts[2], parts[1]-1, parts[0]);
      const dow = dt.getDay();
      if (!(barbeiro.diasAtendimento || []).includes(dow)) return [];
    }
  }

  return slots.map(slot => ({
    horario: slot,
    disponivel: !ocupados.includes(slot)
  }));
}

/* ── Bloqueia horário de um barbeiro ── */
export function bloquearHorarioBarbeiro(barbeiroId, horario) {
  const barbeiro = (adminSettings.barbeiros || []).find(b => b.id === barbeiroId);
  if (!barbeiro) return false;
  if (!barbeiro.takenSlots) barbeiro.takenSlots = [];
  if (!barbeiro.takenSlots.includes(horario)) barbeiro.takenSlots.push(horario);
  return true;
}

/* ── Libera horário de um barbeiro ── */
export function liberarHorarioBarbeiro(barbeiroId, horario) {
  const barbeiro = (adminSettings.barbeiros || []).find(b => b.id === barbeiroId);
  if (!barbeiro) return false;
  barbeiro.takenSlots = (barbeiro.takenSlots || []).filter(h => h !== horario);
  return true;
}

/* ── Salva/atualiza barbeiro no Firestore ── */
export async function salvarBarbeiro(barbeiroData) {
  if (!window._fb) return barbeiroData;
  const { doc, setDoc, db } = window._fb;
  await setDoc(doc(db, 'barbeiros', barbeiroData.id), barbeiroData, { merge: true });
  return barbeiroData;
}

/* ── Carrega barbeiros do Firestore ── */
export async function carregarBarbeirosFirestore() {
  if (!window._fb) return adminSettings.barbeiros || [];
  const { collection, getDocs, db } = window._fb;
  try {
    const snap = await getDocs(collection(db, 'barbeiros'));
    const barbeiros = [];
    snap.forEach(d => barbeiros.push({ id: d.id, ...d.data() }));
    return barbeiros.length ? barbeiros : adminSettings.barbeiros;
  } catch (e) {
    return adminSettings.barbeiros || [];
  }
}
