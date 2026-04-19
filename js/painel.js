/* ══════════════════════════════════════════
   PAINEL.JS — Painel individual do barbeiro
   Barbearia do Davi
══════════════════════════════════════════ */

let _barbeiro     = null;
let _agendamentos = [];
let _dataAtual    = _hoje();

/* ─── Helpers de data ─────────────────── */
function _hoje() { return _fmtBR(new Date()); }
function _fmtBR(d) { return d.toLocaleDateString('pt-BR'); }
function _parseBR(str) {
  const [d,m,y] = str.split('/');
  return new Date(+y, +m-1, +d);
}
function _addDias(str, n) {
  const d = _parseBR(str);
  d.setDate(d.getDate() + n);
  return _fmtBR(d);
}
function _nomeDia(str) {
  return ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][_parseBR(str).getDay()];
}
function _dataFS(br) {
  const [d,m,y] = br.split('/');
  return `${y}-${m}-${d}`;
}
function _inicioSemana() {
  const d = _parseBR(_hoje());
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function _diasDaSemana() {
  const inicio = _inicioSemana();
  return Array.from({length:7}, (_,i) => {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    return _fmtBR(d);
  });
}

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
async function init() {
  let t = 0;
  while (!window._fb && t++ < 40) await new Promise(r => setTimeout(r, 100));
  await _carregarSettings();
  _barbeiro = await _identificarBarbeiro();
  if (!_barbeiro) { _mostrarErroAcesso(); return; }
  _renderHeader();
  await _carregarEAtualizar();

  document.getElementById('btnHoje')?.addEventListener('click', () => {
    _dataAtual = _hoje(); _renderPainelHoje(); _renderNavData();
  });
  document.getElementById('btnAnterior')?.addEventListener('click', () => {
    _dataAtual = _addDias(_dataAtual, -1); _renderPainelHoje(); _renderNavData();
  });
  document.getElementById('btnProximo')?.addEventListener('click', () => {
    _dataAtual = _addDias(_dataAtual, 1); _renderPainelHoje(); _renderNavData();
  });
  document.getElementById('btnLogout')?.addEventListener('click', _fecharPainel);

  window._painelAtualizar = _carregarEAtualizar;
  window._painelRenderTab = _renderTab;
}

async function _carregarSettings() {
  if (!window._fb) return;
  try {
    const snap = await window._fb.getDoc(window._fb.doc(window._fb.db, 'settings', 'admin'));
    if (snap.exists()) window._painelSettings = snap.data();
  } catch(e) {}
}

async function _identificarBarbeiro() {
  if (window._barbeiroPainel) return window._barbeiroPainel;
  try {
    const cached = localStorage.getItem('bbdavi_barbeiro');
    if (cached) {
      const u = JSON.parse(cached);
      if (u?.isBarbeiro && u?.barbeiroId) {
        window.fbUser = u;
        const s = window._painelSettings || {};
        return (s.barbeiros || []).find(b => b.id === u.barbeiroId) || null;
      }
    }
  } catch(_) {}
  return null;
}

async function _carregarEAtualizar() {
  const btn = document.getElementById('btnAtualizar');
  if (btn) { btn.textContent = '⏳ CARREGANDO…'; btn.disabled = true; }
  _agendamentos = await _buscarAgendamentos();
  _renderPainelHoje();
  _renderNavData();
  _renderStats();
  if (btn) { btn.textContent = '🔄 ATUALIZAR'; btn.disabled = false; }
}

async function _buscarAgendamentos() {
  if (!window._fb || !_barbeiro) return [];
  try {
    const { collection, getDocs, query, where, db } = window._fb;
    const q = query(collection(db, 'agendamentos'), where('barbeiroId', '==', _barbeiro.id));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return []; }
}

function _agNaData(data) {
  return _agendamentos
    .filter(a => { const d = a.data||''; return d === data || d === _dataFS(data); })
    .sort((a,b) => (a.horario||'').localeCompare(b.horario||''));
}

/* ─── Header ── */
function _renderHeader() {
  const n = document.getElementById('painelNomeBarbeiro');
  if (n) n.textContent = 'DO ' + (_barbeiro.nome||'').toUpperCase();
  const e = document.getElementById('painelEspecialidade');
  if (e) e.textContent = (_barbeiro.especialidade || 'Barbeiro') + ' · Barbearia do Davi · Vila Guará, Luziânia – GO';
}

/* ─── Stats ── */
function _renderStats() {
  const lista = _agNaData(_hoje());
  _set('statTotal',    lista.length);
  _set('statPendentes', lista.filter(a => !a.status || a.status==='confirmado'||a.status==='pendente').length);
  _set('statFeitos',   lista.filter(a => a.status==='realizado'||a.status==='concluido').length);
  const semana = _diasDaSemana();
  const totalSemana = _agendamentos.filter(a => {
    const d = a.data||''; return semana.some(s => s===d || _dataFS(s)===d);
  }).length;
  _set('statSemana', totalSemana);
}

/* ─── Nav Data ── */
function _renderNavData() {
  const label = document.getElementById('navDataLabel');
  if (!label) return;
  const hoje = _hoje();
  const ontem = _addDias(hoje,-1), amanha = _addDias(hoje,1);
  let txt;
  if (_dataAtual===hoje) txt = `HOJE · ${_nomeDia(_dataAtual)}, ${_dataAtual}`;
  else if (_dataAtual===ontem) txt = `ONTEM · ${_nomeDia(_dataAtual)}, ${_dataAtual}`;
  else if (_dataAtual===amanha) txt = `AMANHÃ · ${_nomeDia(_dataAtual)}, ${_dataAtual}`;
  else txt = `${_nomeDia(_dataAtual).toUpperCase()}, ${_dataAtual}`;
  label.textContent = txt;
  const btnH = document.getElementById('btnHoje');
  if (btnH) btnH.style.display = _dataAtual===hoje ? 'none' : 'inline-flex';
}

/* ─── Painel Hoje ── */
function _renderPainelHoje() {
  const lista = _agNaData(_dataAtual);
  _renderProximo(lista);
  const container = document.getElementById('listaAgendamentos');
  if (!container) return;
  if (!lista.length) { container.innerHTML = _htmlVazio('Nenhum agendamento<br>para este dia'); return; }
  container.innerHTML = lista.map(_htmlCard).join('');
}

/* ─── Painel Amanhã ── */
function _renderPainelAmanha() {
  const amanha = _addDias(_hoje(), 1);
  const lista  = _agNaData(amanha);
  const c = document.getElementById('listaAmanha');
  if (!c) return;
  if (!lista.length) { c.innerHTML = _htmlVazio('Nenhum agendamento<br>para amanhã'); return; }
  c.innerHTML = lista.map(_htmlCard).join('');
}

/* ─── Painel Semana ── */
function _renderPainelSemana() {
  const dias = _diasDaSemana();
  const c = document.getElementById('listaSemana');
  if (!c) return;
  const hoje = _hoje();
  let html = '';
  dias.forEach(dia => {
    const lista = _agNaData(dia);
    const isHoje = dia === hoje;
    html += `<div class="semana-day-header">
      ${_nomeDia(dia).toUpperCase()} <span>${dia}${isHoje ? ' · HOJE' : ''}</span>
      <span style="color:var(--gray2);font-size:0.7rem">${lista.length} agendamento${lista.length!==1?'s':''}</span>
    </div>`;
    if (!lista.length) {
      html += `<div style="font-size:0.78rem;color:var(--gray2);padding:0.4rem 0 0.8rem">Nenhum agendamento</div>`;
    } else {
      html += lista.map(_htmlCard).join('');
    }
  });
  c.innerHTML = html;
}

function _renderTab(tab) {
  if (tab === 'amanha') _renderPainelAmanha();
  if (tab === 'semana') _renderPainelSemana();
}

/* ─── Próximo destaque ── */
function _renderProximo(lista) {
  const agora = new Date();
  const horaAtual = `${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`;
  const prox = _dataAtual === _hoje()
    ? lista.find(a => (a.horario||'') >= horaAtual && a.status!=='realizado' && a.status!=='concluido' && a.status!=='cancelado')
    : null;
  const wrap = document.getElementById('proximoWrap');
  const info = document.getElementById('proximoCliente');
  if (wrap && info) {
    if (prox) {
      info.innerHTML = `<span class="prox-hora">${prox.horario}</span><span class="prox-nome">${prox.cliente}</span><span class="prox-svc">${prox.servicos||''}</span>`;
      wrap.style.display = 'flex';
    } else {
      wrap.style.display = 'none';
    }
  }
}

/* ─── Card HTML ── */
function _htmlCard(a) {
  const st = a.status || 'confirmado';
  const feito     = st==='realizado'||st==='concluido';
  const cancelado = st==='cancelado';
  const badgeCls  = feito ? 'badge-feito' : cancelado ? 'badge-cancelado' : 'badge-agendado';
  const badgeTxt  = feito ? '✓ Concluído' : cancelado ? '✕ Cancelado' : '⏳ Agendado';
  const total     = a.total ? `💰 R$ ${Number(a.total).toFixed(2).replace('.',',')}` : '';
  const btn = (!feito && !cancelado)
    ? `<button class="btn-concluir-adm" onclick="marcarConcluido('${a.id}')" id="btn_${a.id}">✓ CONCLUIR</button>`
    : '';
  return `
  <div class="barb-agend-card ${feito?'card-feito':''} ${cancelado?'card-cancelado':''}" id="card_${a.id}">
    <div class="bag-hora">${a.horario||'--:--'}</div>
    <div class="bag-info">
      <div class="bag-cliente">${a.cliente||'Cliente'}</div>
      <div class="bag-svc">${a.servicos||'Serviço não informado'}</div>
      <div class="bag-meta">
        ${a.telefone?`<span>📱 ${a.telefone}</span>`:''}
        ${total?`<span>${total}</span>`:''}
        ${a.formaPagamento?`<span>${a.formaPagamento}</span>`:''}
      </div>
    </div>
    <div class="bag-actions">
      <span class="bag-badge ${badgeCls}">${badgeTxt}</span>
      ${btn}
    </div>
  </div>`;
}

function _htmlVazio(msg) {
  return `<div class="barb-empty"><div class="barb-empty-icon">📅</div><div class="barb-empty-txt">${msg}</div></div>`;
}

/* ─── Marcar concluído ── */
window.marcarConcluido = async function(id) {
  const btn = document.getElementById('btn_'+id);
  if (btn) { btn.disabled=true; btn.textContent='⏳ SALVANDO…'; }
  try {
    if (window._fb) {
      await window._fb.setDoc(
        window._fb.doc(window._fb.db,'agendamentos',id),
        { status:'realizado' }, { merge:true }
      );
    }
    const ag = _agendamentos.find(a => a.id===id);
    if (ag) ag.status = 'realizado';
    _renderPainelHoje();
    _renderStats();
    _mostrarToast('✅ Agendamento concluído!');
  } catch(e) {
    if (btn) { btn.disabled=false; btn.textContent='✓ CONCLUIR'; }
    _mostrarToast('⚠️ Erro ao salvar.');
  }
};

/* ─── Fechar / Sair ── */
function _fecharPainel() { window.location.href = '../index.html'; }

/* ─── Erro de acesso ── */
function _mostrarErroAcesso() {
  document.getElementById('painelApp').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;gap:1rem;text-align:center">
      <div style="font-size:3rem">🔒</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:2rem;color:var(--white)">ACESSO NEGADO</div>
      <div style="font-size:0.85rem;color:var(--gray);max-width:320px;line-height:1.6">
        Você precisa fazer login como barbeiro para acessar este painel.
      </div>
      <a href="../index.html" class="adm-save-btn" style="text-decoration:none;margin-top:1rem">← VOLTAR AO SITE</a>
    </div>`;
}

/* ─── Helpers ── */
function _set(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }

function _mostrarToast(msg) {
  let t = document.getElementById('painelToast');
  if (!t) { t=document.createElement('div'); t.id='painelToast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();
