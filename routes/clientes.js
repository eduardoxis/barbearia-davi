/* ══════════════════════════════════════════
   ROUTES/CLIENTES.JS
   CRM — Gestão de clientes
   Barbearia do Davi
══════════════════════════════════════════ */

export const CRM_INATIVO_DIAS = 45;
export const CRM_VIP_VISITAS  = 5;

/* ── Chave única por cliente ── */
export function chaveCliente(ag) {
  if (ag.email && ag.email.trim()) return ag.email.trim().toLowerCase();
  const t = (ag.telefone || ag.whatsapp || ag.phone || '').replace(/\D/g, '');
  return t || ('nome_' + (ag.cliente || '').toLowerCase().trim().replace(/\s+/g, '_'));
}

/* ── Dias desde a última visita ── */
export function diasDesde(dataStr) {
  if (!dataStr) return 9999;
  const parts = dataStr.split('/');
  const d = parts.length === 3
    ? new Date(parts[2] + '-' + parts[1] + '-' + parts[0])
    : new Date(dataStr);
  if (isNaN(d)) return 9999;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/* ── Intervalo médio entre visitas ── */
export function intervaloMedio(agendamentos) {
  if (agendamentos.length < 2) return null;
  const datas = agendamentos
    .map(a => {
      const p = (a.data || '').split('/');
      return p.length === 3 ? new Date(p[2] + '-' + p[1] + '-' + p[0]) : new Date(a.data || '');
    })
    .filter(d => !isNaN(d))
    .sort((a, b) => a - b);
  if (datas.length < 2) return null;
  const diff = (datas[datas.length - 1] - datas[0]) / 86400000;
  return Math.round(diff / (datas.length - 1));
}

/* ── Ranking de serviços ── */
export function rankServicos(agendamentos) {
  const mapa = {};
  agendamentos.forEach(a => {
    (a.servicos || '').split(',').map(s => s.trim().replace(/^[^\w]+/, '')).filter(Boolean).forEach(sv => {
      mapa[sv] = (mapa[sv] || 0) + 1;
    });
  });
  return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
}

/* ── Agrupa agendamentos por cliente ── */
export function agruparPorCliente(agendamentos) {
  const clientes = {};
  agendamentos.forEach(ag => {
    const key = chaveCliente(ag);
    if (!clientes[key]) {
      clientes[key] = {
        nome:  ag.cliente || ag.name || '(sem nome)',
        email: (ag.email || '').trim().toLowerCase(),
        tel:   ag.telefone || ag.whatsapp || ag.phone || '',
        agendamentos: [],
        obs: '',
      };
    }
    clientes[key].agendamentos.push(ag);
  });
  Object.values(clientes).forEach(c => {
    c.agendamentos.sort((a, b) => (b.criadoEm || b.data || '') > (a.criadoEm || a.data || '') ? 1 : -1);
  });
  return clientes;
}

/* ── Salva observação do barbeiro no Firestore ── */
export async function salvarObservacao(chave, obs) {
  if (!window._fb) throw new Error('Firebase não disponível.');
  const { doc, setDoc, db } = window._fb;
  await setDoc(doc(db, 'crm_obs', chave), { obs, atualizadoEm: new Date().toISOString() }, { merge: true });
}

/* ── Carrega observações do Firestore ── */
export async function carregarObservacoes() {
  if (!window._fb) return {};
  const { collection, getDocs, db } = window._fb;
  const obs = {};
  try {
    const snap = await getDocs(collection(db, 'crm_obs'));
    snap.forEach(d => { obs[d.id] = d.data().obs || ''; });
  } catch (e) { /* ignora */ }
  return obs;
}
