/* ══════════════════════════════════════════
   PAINEL.JS — Painel individual do barbeiro
   Mostra a agenda própria, status dos
   agendamentos e permite marcar como concluído
   Barbearia do Davi
══════════════════════════════════════════ */

/* ─── Estado ─────────────────────────── */
let _barbeiro    = null;   // objeto barbeiro logado
let _agendamentos = [];    // todos os agendamentos carregados
let _dataAtual   = _hoje();// "DD/MM/YYYY" exibida
let _salvandoId  = null;   // evita clique duplo

/* ─── Helpers de data ─────────────────── */
function _hoje() {
  return _fmtBR(new Date());
}
function _fmtBR(d) {
  return d.toLocaleDateString('pt-BR'); // DD/MM/YYYY
}
function _parseBR(str) {
  const [d, m, y] = str.split('/');
  return new Date(+y, +m - 1, +d);
}
function _addDias(str, n) {
  const d = _parseBR(str);
  d.setDate(d.getDate() + n);
  return _fmtBR(d);
}
function _nomeDia(str) {
  const dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  return dias[_parseBR(str).getDay()];
}
function _dataFirestore(br) {
  // DD/MM/YYYY → YYYY-MM-DD
  const [d, m, y] = br.split('/');
  return `${y}-${m}-${d}`;
}

/* ═══════════════════════════════════════
   INICIALIZAÇÃO
═══════════════════════════════════════ */
async function init() {
  // 1. Aguarda Firebase ficar pronto
  let tentativas = 0;
  while (!window._fb && tentativas < 40) {
    await new Promise(r => setTimeout(r, 100));
    tentativas++;
  }

  // 2. Carrega settings (barbeiros + adminSettings)
  await _carregarSettings();

  // 3. Identifica barbeiro logado
  _barbeiro = await _identificarBarbeiro();

  if (!_barbeiro) {
    _mostrarErroAcesso();
    return;
  }

  // 4. Renderiza header
  _renderHeader();

  // 5. Carrega agendamentos e renderiza
  await _carregarEAtualizar();

  // 6. Botão de navegação de datas
  document.getElementById('btnHoje')?.addEventListener('click', () => {
    _dataAtual = _hoje();
    _renderAgendamentos();
    _renderNavData();
  });
  document.getElementById('btnAnterior')?.addEventListener('click', () => {
    _dataAtual = _addDias(_dataAtual, -1);
    _renderAgendamentos();
    _renderNavData();
  });
  document.getElementById('btnProximo')?.addEventListener('click', () => {
    _dataAtual = _addDias(_dataAtual, 1);
    _renderAgendamentos();
    _renderNavData();
  });

  // 7. Logout
  document.getElementById('btnLogout')?.addEventListener('click', _fecharPainel);
  document.getElementById('btnSairConta')?.addEventListener('click', _sairDaConta);

  // 8. Atualiza a cada 60s (novos agendamentos em tempo real)
  setInterval(_carregarEAtualizar, 60_000);
}

/* ─── Carrega adminSettings do Firestore ── */
async function _carregarSettings() {
  if (!window._fb) return;
  try {
    const snap = await window._fb.getDoc(
      window._fb.doc(window._fb.db, 'settings', 'admin')
    );
    if (snap.exists()) {
      const data = snap.data();
      // Injeta no global para reutilizar
      window._painelSettings = data;
    }
  } catch (e) {
    console.warn('Painel: erro ao carregar settings', e);
  }
}

/* ─── Identifica quem está logado ── */
async function _identificarBarbeiro() {
  // Primeiro: sessionStorage (persiste na aba)
  const cached = sessionStorage.getItem('_painelBarbeiro');
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  // Segundo: window._barbeiroPainel (set pelo auth.js no login)
  if (window._barbeiroPainel) {
    return window._barbeiroPainel;
  }

  // Terceiro: localStorage (persiste entre abas e recarregamentos)
  try {
    const cached = localStorage.getItem('bbdavi_barbeiro');
    if (cached) {
      const fbUser = JSON.parse(cached);
      if (fbUser?.isBarbeiro && fbUser?.barbeiroId) {
        // Reidrata window.fbUser para o painel funcionar corretamente
        window.fbUser = fbUser;
        // Busca o objeto completo do barbeiro nas settings
        const settings = window._painelSettings || {};
        const barb = (settings.barbeiros || []).find(b => b.id === fbUser.barbeiroId);
        if (barb) return barb;
      }
    }
  } catch (_) {}

  return null;
}

/* ─── Carrega agendamentos e atualiza tela ── */
async function _carregarEAtualizar() {
  _agendamentos = await _buscarAgendamentos();
  _renderAgendamentos();
  _renderNavData();
  _renderStats();
}

/* ─── Busca agendamentos do Firestore ── */
async function _buscarAgendamentos() {
  if (!window._fb || !_barbeiro) return [];
  try {
    const { collection, getDocs, query, where, db } = window._fb;
    const q = query(
      collection(db, 'agendamentos'),
      where('barbeiroId', '==', _barbeiro.id)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('Painel: erro ao buscar agendamentos', e);
    return [];
  }
}

/* ─── Filtra agendamentos da data atual ── */
function _agendamentosNaData(data) {
  return _agendamentos
    .filter(a => {
      // Aceita "DD/MM/YYYY" e "YYYY-MM-DD"
      const d = a.data || '';
      return d === data || d === _dataFirestore(data);
    })
    .sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));
}

/* ═══════════════════════════════════════
   RENDER — HEADER
═══════════════════════════════════════ */
function _renderHeader() {
  const el = document.getElementById('painelNomeBarbeiro');
  if (el) el.textContent = _barbeiro.nome;

  const avatar = document.getElementById('painelAvatar');
  if (avatar) {
    if (_barbeiro.foto) {
      avatar.innerHTML = `<img src="${_barbeiro.foto}" alt="${_barbeiro.nome}" onerror="this.parentElement.textContent='${_barbeiro.emoji||'💈'}'">`;
    } else {
      avatar.textContent = _barbeiro.emoji || '💈';
    }
  }

  const esp = document.getElementById('painelEspecialidade');
  if (esp) esp.textContent = _barbeiro.especialidade || 'Barbeiro profissional';
}

/* ═══════════════════════════════════════
   RENDER — NAVEGAÇÃO DE DATA
═══════════════════════════════════════ */
function _renderNavData() {
  const label = document.getElementById('navDataLabel');
  if (!label) return;

  const hoje = _hoje();
  const ontem = _addDias(hoje, -1);
  const amanha = _addDias(hoje, 1);

  let txt;
  if (_dataAtual === hoje)   txt = `Hoje · ${_nomeDia(_dataAtual)}, ${_dataAtual}`;
  else if (_dataAtual === ontem)  txt = `Ontem · ${_nomeDia(_dataAtual)}, ${_dataAtual}`;
  else if (_dataAtual === amanha) txt = `Amanhã · ${_nomeDia(_dataAtual)}, ${_dataAtual}`;
  else txt = `${_nomeDia(_dataAtual)}, ${_dataAtual}`;

  label.textContent = txt;

  const btnHoje = document.getElementById('btnHoje');
  if (btnHoje) btnHoje.style.display = _dataAtual === hoje ? 'none' : 'inline-flex';
}

/* ═══════════════════════════════════════
   RENDER — STATS
═══════════════════════════════════════ */
function _renderStats() {
  const lista = _agendamentosNaData(_dataAtual);
  const total    = lista.length;
  const feitos   = lista.filter(a => a.status === 'realizado' || a.status === 'concluido').length;
  const pendentes = lista.filter(a => a.status === 'confirmado' || a.status === 'pendente' || !a.status).length;

  _set('statTotal',    total);
  _set('statFeitos',   feitos);
  _set('statPendentes', pendentes);

  // Próximo agendamento
  const agora = new Date();
  const horaAtual = `${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`;
  const prox = _dataAtual === _hoje()
    ? lista.find(a => (a.horario || '') >= horaAtual && a.status !== 'realizado' && a.status !== 'concluido' && a.status !== 'cancelado')
    : null;

  const proxWrap = document.getElementById('proximoWrap');
  const proxEl   = document.getElementById('proximoCliente');
  if (proxWrap && proxEl) {
    if (prox) {
      proxEl.innerHTML = `<span class="prox-hora">${prox.horario}</span> <span class="prox-nome">${prox.cliente}</span> <span class="prox-svc">${prox.servicos || ''}</span>`;
      proxWrap.style.display = 'flex';
    } else {
      proxWrap.style.display = 'none';
    }
  }
}

/* ═══════════════════════════════════════
   RENDER — LISTA DE AGENDAMENTOS
═══════════════════════════════════════ */
function _renderAgendamentos() {
  _renderStats();
  const lista = _agendamentosNaData(_dataAtual);
  const container = document.getElementById('listaAgendamentos');
  if (!container) return;

  if (!lista.length) {
    container.innerHTML = `
      <div class="painel-vazio">
        <div class="painel-vazio-icon">📅</div>
        <div class="painel-vazio-txt">Nenhum agendamento<br>para este dia</div>
      </div>`;
    return;
  }

  container.innerHTML = lista.map(a => _htmlCard(a)).join('');
}

function _htmlCard(a) {
  const status = a.status || 'confirmado';
  const isFeito    = status === 'realizado' || status === 'concluido';
  const isCancelado = status === 'cancelado';

  const badgeCls = isFeito ? 'badge-feito' : isCancelado ? 'badge-cancelado' : 'badge-pendente';
  const badgeTxt = isFeito ? '✓ Concluído' : isCancelado ? '✕ Cancelado' : '⏳ Agendado';

  const btnConcluir = (!isFeito && !isCancelado)
    ? `<button class="btn-concluir" onclick="marcarConcluido('${a.id}')" id="btn_${a.id}">
         ✓ Marcar como concluído
       </button>`
    : '';

  const svcs = a.servicos || 'Serviço não informado';
  const total = a.total ? `R$ ${Number(a.total).toFixed(2).replace('.',',')}` : '';

  return `
  <div class="painel-card ${isFeito ? 'card-feito' : ''} ${isCancelado ? 'card-cancelado' : ''}" id="card_${a.id}">
    <div class="painel-card-hora">${a.horario || '--:--'}</div>
    <div class="painel-card-info">
      <div class="painel-card-cliente">${a.cliente || 'Cliente'}</div>
      <div class="painel-card-svc">${svcs}</div>
      <div class="painel-card-meta">
        ${a.telefone ? `<span>📱 ${a.telefone}</span>` : ''}
        ${total ? `<span>💰 ${total}</span>` : ''}
        ${a.formaPagamento ? `<span>${a.formaPagamento}</span>` : ''}
      </div>
      <div class="painel-card-badge ${badgeCls}">${badgeTxt}</div>
      ${btnConcluir}
    </div>
  </div>`;
}

/* ═══════════════════════════════════════
   AÇÃO — MARCAR COMO CONCLUÍDO
═══════════════════════════════════════ */
window.marcarConcluido = async function(agendId) {
  if (_salvandoId === agendId) return;
  _salvandoId = agendId;

  const btn = document.getElementById('btn_' + agendId);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando…'; }

  try {
    if (window._fb) {
      const { doc, setDoc, db } = window._fb;
      await setDoc(doc(db, 'agendamentos', agendId), { status: 'realizado' }, { merge: true });
    }
    // Atualiza local
    const ag = _agendamentos.find(a => a.id === agendId);
    if (ag) ag.status = 'realizado';

    _renderAgendamentos();
    _mostrarToast('✅ Agendamento marcado como concluído!');
  } catch (e) {
    console.error('Erro ao marcar concluído:', e);
    if (btn) { btn.disabled = false; btn.textContent = '✓ Marcar como concluído'; }
    _mostrarToast('⚠️ Erro ao salvar. Tente novamente.');
  } finally {
    _salvandoId = null;
  }
};

/* ═══════════════════════════════════════
   ✕ FECHAR — volta pro site, sessão MANTIDA
   (igual ao X do painel admin)
═══════════════════════════════════════ */
function _fecharPainel() {
  window.location.href = '../index.html';
}

/* ═══════════════════════════════════════
   SAIR DA CONTA — desloga completamente
═══════════════════════════════════════ */
function _sairDaConta() {
  try { localStorage.removeItem('bbdavi_barbeiro'); } catch (_) {}
  window.fbUser = null;
  window._barbeiroPainel = null;
  window.location.href = '../index.html';
}

/* ═══════════════════════════════════════
   ERRO DE ACESSO
═══════════════════════════════════════ */
function _mostrarErroAcesso() {
  document.getElementById('painelApp').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:1rem;padding:2rem;text-align:center">
      <div style="font-size:3rem">🔒</div>
      <div style="font-family:'Oswald',sans-serif;font-size:1.4rem;color:var(--white)">Acesso Negado</div>
      <div style="font-size:0.85rem;color:var(--gray);line-height:1.6;max-width:300px">
        Você precisa fazer login como barbeiro para acessar este painel.
      </div>
      <a href="index.html" class="btn-red" style="margin-top:1rem;text-decoration:none">← Voltar ao site</a>
    </div>`;
}

/* ═══════════════════════════════════════
   HELPERS
═══════════════════════════════════════ */
function _set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function _mostrarToast(msg) {
  let t = document.getElementById('painelToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'painelToast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ─── Arranca ─────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
