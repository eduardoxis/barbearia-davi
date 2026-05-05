/* ══════════════════════════════════════════
   ADMIN-LOG.JS — Registro de ações do ADM
   Barbearia do Davi
   
   Salva no Firestore: collection 'admin_logs'
   Cada doc: { acao, detalhes, quem, quando, icone, categoria }
══════════════════════════════════════════ */

/* ── Categorias e ícones ── */
const CATEGORIAS = {
  servico:    { label: 'Serviço',     icone: '✂' },
  barbeiro:   { label: 'Barbeiro',    icone: '💈' },
  horario:    { label: 'Horário',     icone: '🕐' },
  status:     { label: 'Status',      icone: '🔴' },
  bloqueio:   { label: 'Bloqueio',    icone: '🔒' },
  config:     { label: 'Config',      icone: '⚙' },
  agendamento:{ label: 'Agendamento', icone: '📋' },
  backup:     { label: 'Backup',      icone: '📦' },
};

/* ── Cache em memória para exibição instantânea ── */
let _logsCache = [];

/* ──────────────────────────────────────────
   REGISTRAR UMA AÇÃO
   Uso: registrarLog('Serviço adicionado', 'Corte Degradê — R$ 35', 'servico')
────────────────────────────────────────── */
export async function registrarLog(acao, detalhes = '', categoria = 'config') {
  const quem = _getQuem();
  const agora = new Date();
  const entry = {
    acao,
    detalhes,
    categoria,
    icone: CATEGORIAS[categoria]?.icone || '📝',
    quem,
    quando: agora.toISOString(),
    quandoFormatado: agora.toLocaleString('pt-BR'),
  };

  /* Salva no cache local imediatamente */
  _logsCache.unshift(entry);
  if (_logsCache.length > 200) _logsCache.pop();

  /* Re-renderiza se a tab de log estiver visível */
  const painel = document.getElementById('admTab-log');
  if (painel?.classList.contains('active')) renderLog();

  /* Persiste no Firestore */
  try {
    if (window._fb) {
      await window._fb.addDoc(
        window._fb.collection(window._fb.db, 'admin_logs'),
        entry
      );
    }
  } catch (e) {
    console.warn('[admin-log] Erro ao salvar log:', e.message);
  }
}

/* ──────────────────────────────────────────
   CARREGAR LOGS DO FIRESTORE
────────────────────────────────────────── */
export async function carregarLogs() {
  const lista = document.getElementById('logLista');
  if (lista) lista.innerHTML = '<div class="log-loading">⏳ Carregando registros...</div>';

  try {
    if (!window._fb) throw new Error('Firebase não disponível');

    const { query, collection, orderBy, limit, getDocs, db } = window._fb;
    const q = query(
      collection(db, 'admin_logs'),
      orderBy('quando', 'desc'),
      limit(150)
    );
    const snap = await getDocs(q);
    _logsCache = [];
    snap.forEach(doc => _logsCache.push({ _id: doc.id, ...doc.data() }));
  } catch (e) {
    console.warn('[admin-log] Carregando apenas cache local:', e.message);
  }

  renderLog();
}

/* ──────────────────────────────────────────
   LIMPAR TODOS OS LOGS
────────────────────────────────────────── */
export async function limparLogs() {
  if (!confirm('Limpar todos os registros? Esta ação não pode ser desfeita.')) return;

  try {
    if (window._fb) {
      const { query, collection, getDocs, deleteDoc, doc, db } = window._fb;
      const snap = await getDocs(collection(db, 'admin_logs'));
      const promises = [];
      snap.forEach(d => promises.push(deleteDoc(doc(db, 'admin_logs', d.id))));
      await Promise.all(promises);
    }
    _logsCache = [];
    renderLog();

    const { showToast } = await import('./global.js');
    showToast('🗑 Logs limpos.');
  } catch (e) {
    const { showToast } = await import('./global.js');
    showToast('❌ Erro ao limpar: ' + e.message);
  }
}

/* ──────────────────────────────────────────
   EXPORTAR LOGS COMO JSON
────────────────────────────────────────── */
export function exportarLogs() {
  const dados = {
    exportadoEm: new Date().toLocaleString('pt-BR'),
    total: _logsCache.length,
    registros: _logsCache,
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'logs-admin-' + new Date().toISOString().split('T')[0] + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ──────────────────────────────────────────
   RENDERIZAR LISTA DE LOGS
────────────────────────────────────────── */
let _logFiltroCategoria = 'todos';
let _logBusca = '';

export function renderLog() {
  const lista    = document.getElementById('logLista');
  const total    = document.getElementById('logTotal');
  if (!lista) return;

  /* Aplica filtros */
  let dados = [..._logsCache];
  if (_logFiltroCategoria !== 'todos') {
    dados = dados.filter(l => l.categoria === _logFiltroCategoria);
  }
  if (_logBusca.trim()) {
    const t = _logBusca.toLowerCase();
    dados = dados.filter(l =>
      (l.acao     || '').toLowerCase().includes(t) ||
      (l.detalhes || '').toLowerCase().includes(t) ||
      (l.quem     || '').toLowerCase().includes(t)
    );
  }

  if (total) total.textContent = dados.length + ' registro' + (dados.length !== 1 ? 's' : '');

  if (!dados.length) {
    lista.innerHTML = '<div class="log-empty">📭 Nenhum registro encontrado.</div>';
    return;
  }

  lista.innerHTML = '';
  dados.forEach(entry => {
    const cat = CATEGORIAS[entry.categoria] || { label: entry.categoria, icone: '📝' };
    const item = document.createElement('div');
    item.className = 'log-item log-cat-' + (entry.categoria || 'config');
    item.innerHTML = `
      <div class="log-item-icon">${entry.icone || cat.icone}</div>
      <div class="log-item-body">
        <div class="log-item-acao">${_esc(entry.acao)}</div>
        ${entry.detalhes ? `<div class="log-item-detalhes">${_esc(entry.detalhes)}</div>` : ''}
        <div class="log-item-meta">
          <span class="log-cat-badge log-cat-badge-${entry.categoria}">${cat.icone} ${cat.label}</span>
          <span class="log-item-quem">👤 ${_esc(entry.quem || '—')}</span>
          <span class="log-item-quando">🕐 ${_esc(entry.quandoFormatado || entry.quando || '—')}</span>
        </div>
      </div>`;
    lista.appendChild(item);
  });
}

export function setLogFiltroCategoria(cat) {
  _logFiltroCategoria = cat;
  document.querySelectorAll('.log-filtro-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  renderLog();
}

export function setLogBusca(valor) {
  _logBusca = valor;
  renderLog();
}

/* ──────────────────────────────────────────
   HELPERS INTERNOS
────────────────────────────────────────── */
function _getQuem() {
  try {
    /* 1. Barbeiro logado no painel de barbeiro */
    const barbId   = window._barbLogadoId;
    const settings = window._adminSettings;
    if (barbId && settings?.barbeiros) {
      const b = settings.barbeiros.find(x => x.id === barbId);
      if (b?.nome) return b.nome;
    }
    /* 2. Admin com nome resolvido (via Firestore admins[] ou barbeiros[]) */
    if (window._adminLogadoNome) return window._adminLogadoNome;
    /* 3. Fallback: email prefix */
    if (window._adminLogadoEmail) {
      const prefix = window._adminLogadoEmail.split('@')[0];
      return 'Admin (' + prefix + ')';
    }
  } catch (_) {}
  return 'Admin';
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ──────────────────────────────────────────
   EXPOSIÇÃO GLOBAL
────────────────────────────────────────── */
window.carregarLogs            = carregarLogs;
window.limparLogs              = limparLogs;
window.exportarLogs            = exportarLogs;
window.setLogFiltroCategoria   = setLogFiltroCategoria;
window.setLogBusca             = setLogBusca;
window.renderLog               = renderLog;
