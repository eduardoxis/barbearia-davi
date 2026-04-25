/* ══════════════════════════════════════════
   PAINEL.JS — Painel individual do barbeiro
   Barbearia do Davi
══════════════════════════════════════════ */

let _barbeiro          = null;
let _agendamentos      = [];
let _dataAtual         = _hoje();
let _diasBloqueadosPainel = [];

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
  // Auth anônima roda em background — NÃO bloqueia o carregamento da UI
  await _carregarSettings();
  _barbeiro = await _identificarBarbeiro();
  if (!_barbeiro) { _mostrarErroAcesso(); return; }
  _renderHeader();
  await _carregarEAtualizar();
  await _loadDiasBloqueados();

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

  // Renderiza a aba que já estava ativa quando init terminou
  const tabAtiva = document.querySelector('.barb-tab.active');
  if (tabAtiva) {
    const id = tabAtiva.id.replace('tab', '').toLowerCase();
    if (id !== 'hoje') _renderTab(id);
  }
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
  if (tab === 'amanha')    _renderPainelAmanha();
  if (tab === 'semana')    _renderPainelSemana();
  if (tab === 'story')     _initStoryTab();
  if (tab === 'calendario') {
    _renderCalendarioBarbeiro();
    if (!_calNavRegistrado) {
      document.getElementById('calBarbPrev')?.addEventListener('click', () => {
        _calMes--; if (_calMes < 0) { _calMes = 11; _calAno--; } _renderCalendarioBarbeiro();
      });
      document.getElementById('calBarbNext')?.addEventListener('click', () => {
        _calMes++; if (_calMes > 11) { _calMes = 0; _calAno++; } _renderCalendarioBarbeiro();
      });
      _calNavRegistrado = true;
    }
  }
  if (tab === 'agenda') _renderMinhaAgenda();
}

/* ══════════════════════════════════════════
   MINHA AGENDA — configuração pelo barbeiro
══════════════════════════════════════════ */
let _agendaIntervalo = 60;

function _renderMinhaAgenda() {
  if (!_barbeiro) return;

  // Foto atual
  const emoji = document.getElementById('painelFotoEmoji');
  if (emoji && _barbeiro.emoji) emoji.textContent = _barbeiro.emoji;
  _painelAtualizarAvatarUI(_barbeiro.foto || '');

  // Instagram
  const instaEl = document.getElementById('painelInstagram');
  if (instaEl) instaEl.value = _barbeiro.instagram ? `https://instagram.com/${_barbeiro.instagram}` : '';
  const instaDisplay = document.getElementById('painelInstagramDisplay');
  if (instaDisplay) instaDisplay.textContent = _barbeiro.instagram ? `@${_barbeiro.instagram}` : '';

  // Dias
  const diasAtivos = _barbeiro.diasAtendimento || [1,2,3,4,5,6];
  document.querySelectorAll('#agendaDiasGrid .agenda-dia-btn').forEach(btn => {
    btn.classList.toggle('on', diasAtivos.includes(parseInt(btn.dataset.dia)));
    btn.onclick = () => { btn.classList.toggle('on'); _atualizarPreviewSlots(); };
  });

  // Horários
  const inicio = document.getElementById('agendaInicio');
  const fim    = document.getElementById('agendaFim');
  if (inicio) { inicio.value = _barbeiro.horarioInicio || '08:00'; inicio.oninput = _atualizarPreviewSlots; }
  if (fim)    { fim.value    = _barbeiro.horarioFim    || '18:00'; fim.oninput    = _atualizarPreviewSlots; }

  // Intervalo
  _agendaIntervalo = _barbeiro.intervalo || 60;
  document.querySelectorAll('#agendaIntervaloGrid .agenda-int-btn').forEach(btn => {
    const min = parseInt(btn.dataset.min);
    btn.classList.toggle('on', min === _agendaIntervalo);
    btn.onclick = () => {
      document.querySelectorAll('#agendaIntervaloGrid .agenda-int-btn').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      _agendaIntervalo = min;
      _atualizarPreviewSlots();
    };
  });

  // Data mínima para bloqueio de dias
  const bloqDate = document.getElementById('painelBloqDate');
  if (bloqDate) bloqDate.min = new Date().toISOString().split('T')[0];

  _atualizarPreviewSlots();
  _renderDiasBloqueados();
}

function _atualizarPreviewSlots() {
  const inicio = document.getElementById('agendaInicio')?.value || '08:00';
  const fim    = document.getElementById('agendaFim')?.value    || '18:00';
  const diasAtivos = [...document.querySelectorAll('#agendaDiasGrid .agenda-dia-btn.on')]
    .map(b => parseInt(b.dataset.dia));

  // Validação vs horário da barbearia
  const hintEl = document.getElementById('agendaLimiteHint');
  if (hintEl) {
    if (diasAtivos.length) {
      const lim   = _getShopConstraintsForDays(diasAtivos);
      const erros = _validarHorarioBarbeiro(inicio, fim, diasAtivos);
      if (erros.length) {
        hintEl.innerHTML = `⚠️ Fora do horário da barbearia`;
        hintEl.title = erros.join('\n');
        hintEl.style.color = 'var(--red)';
        hintEl.style.display = 'block';
      } else if (lim) {
        hintEl.textContent = `✓ Dentro do horário da barbearia (${lim.open}–${lim.close})`;
        hintEl.style.color = '#27ae60';
        hintEl.style.display = 'block';
      } else {
        hintEl.style.display = 'none';
      }
    } else {
      hintEl.style.display = 'none';
    }
  }

  const slots = _gerarSlots(inicio, fim, _agendaIntervalo);
  const wrap  = document.getElementById('agendaSlotsPreview');
  if (!wrap) return;
  if (!slots.length) {
    wrap.innerHTML = '<span style="font-size:0.75rem;color:var(--gray)">Nenhum horário gerado. Verifique início/fim.</span>';
    return;
  }
  wrap.innerHTML = slots.map(s => `<span class="agenda-slot-pill">${s}</span>`).join('');
}

function _gerarSlots(inicio, fim, intervalo) {
  const slots = [];
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);
  let mins = hi * 60 + mi;
  const fimMins = hf * 60 + mf;
  while (mins + intervalo <= fimMins) {
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
    mins += intervalo;
  }
  return slots;
}

window.salvarMinhaAgenda = async function() {
  const btn = document.getElementById('agendaSaveBtn');
  const msg = document.getElementById('agendaSaveMsg');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ SALVANDO…'; }
  if (msg) msg.textContent = '';

  const diasAtivos = [...document.querySelectorAll('#agendaDiasGrid .agenda-dia-btn.on')]
    .map(b => parseInt(b.dataset.dia));
  const inicio = document.getElementById('agendaInicio')?.value || '08:00';
  const fim    = document.getElementById('agendaFim')?.value    || '18:00';

  if (!diasAtivos.length) {
    if (msg) { msg.style.color = 'var(--red)'; msg.textContent = '⚠️ Selecione ao menos um dia de atendimento.'; }
    if (btn) { btn.disabled = false; btn.textContent = '💾 SALVAR MINHA AGENDA'; }
    return;
  }

  // Validação vs horário da barbearia
  const errosHorario = _validarHorarioBarbeiro(inicio, fim, diasAtivos);
  if (errosHorario.length) {
    if (msg) { msg.style.color = 'var(--red)'; msg.textContent = '⚠️ ' + errosHorario[0]; }
    if (btn) { btn.disabled = false; btn.textContent = '💾 SALVAR MINHA AGENDA'; }
    return;
  }

  try {
    // Garante que autenticação anônima completou antes do write
    if (window._fbAuthReady) await window._fbAuthReady;

    // Busca settings atuais para não sobrescrever outros campos
    const snap = await window._fb.getDoc(window._fb.doc(window._fb.db, 'settings', 'admin'));
    const settings = snap.exists() ? snap.data() : {};
    const barbeiros = settings.barbeiros || [];
    const idx = barbeiros.findIndex(b => b.id === _barbeiro.id);

    if (idx < 0) throw new Error('Barbeiro não encontrado.');

    barbeiros[idx] = {
      ...barbeiros[idx],
      diasAtendimento: diasAtivos,
      horarioInicio:   inicio,
      horarioFim:      fim,
      intervalo:       _agendaIntervalo,
    };

    // Salva de volta no Firestore
    await window._fb.setDoc(
      window._fb.doc(window._fb.db, 'settings', 'admin'),
      { ...settings, barbeiros },
      { merge: true }
    );

    // Atualiza local
    _barbeiro.diasAtendimento = diasAtivos;
    _barbeiro.horarioInicio   = inicio;
    _barbeiro.horarioFim      = fim;
    _barbeiro.intervalo       = _agendaIntervalo;

    // Atualiza localStorage
    try {
      const cached = JSON.parse(localStorage.getItem('bbdavi_barbeiro') || '{}');
      cached.diasAtendimento = diasAtivos;
      cached.horarioInicio   = inicio;
      cached.horarioFim      = fim;
      cached.intervalo       = _agendaIntervalo;
      localStorage.setItem('bbdavi_barbeiro', JSON.stringify(cached));
    } catch(_) {}

    if (msg) { msg.style.color = '#27ae60'; msg.textContent = '✅ Agenda salva com sucesso!'; }
    _mostrarToast('✅ Agenda atualizada!');
    setTimeout(() => { if (msg) msg.textContent = ''; }, 4000);
  } catch(e) {
    console.error(e);
    if (msg) { msg.style.color = 'var(--red)'; msg.textContent = '⚠️ Erro ao salvar. Tente novamente.'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 SALVAR MINHA AGENDA'; }
  }
};

/* ══════════════════════════════════════════
   CALENDÁRIO DO BARBEIRO
══════════════════════════════════════════ */
const _MESES      = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const _DIAS_CURTOS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
let _calMes          = new Date().getMonth();
let _calAno          = new Date().getFullYear();
let _calDiaSel       = null;
let _calNavRegistrado = false;

function _renderCalendarioBarbeiro() {
  const label = document.getElementById('calBarbLabel');
  const grid  = document.getElementById('calBarbGrid');
  if (!label || !grid) return;

  label.textContent = _MESES[_calMes].toUpperCase() + ' · ' + _calAno;
  grid.innerHTML = '';

  // Cabeçalhos dos dias
  _DIAS_CURTOS.forEach(d => {
    const el = document.createElement('div');
    el.className = 'barb-cal-label';
    el.textContent = d;
    grid.appendChild(el);
  });

  const primeiro   = new Date(_calAno, _calMes, 1).getDay();
  const diasNoMes  = new Date(_calAno, _calMes + 1, 0).getDate();
  const hoje       = new Date(); hoje.setHours(0,0,0,0);

  // Células vazias
  for (let i = 0; i < primeiro; i++) {
    const el = document.createElement('div');
    el.className = 'barb-cal-day empty';
    grid.appendChild(el);
  }

  // Dias do mês
  for (let d = 1; d <= diasNoMes; d++) {
    const dt  = new Date(_calAno, _calMes, d);
    const dd  = String(d).padStart(2,'0');
    const mm  = String(_calMes + 1).padStart(2,'0');
    const br  = `${dd}/${mm}/${_calAno}`;
    const iso = `${_calAno}-${mm}-${dd}`;

    const temAg = _agendamentos.some(a => {
      const ad = a.data || '';
      return ad === br || ad === iso;
    });

    const el = document.createElement('div');
    el.className = 'barb-cal-day'
      + (dt.toDateString() === hoje.toDateString() ? ' hoje' : '')
      + (temAg ? ' tem-agend' : '')
      + (_calDiaSel === br ? ' selecionado' : '');
    el.textContent = d;
    el.onclick = () => {
      _calDiaSel = br;
      _renderCalendarioBarbeiro();
      _renderCalDia(br);
    };
    grid.appendChild(el);
  }

  // Se já havia um dia selecionado, renderiza a lista dele
  if (_calDiaSel) _renderCalDia(_calDiaSel);
}

function _renderCalDia(data) {
  const wrap = document.getElementById('calBarbDayWrap');
  if (!wrap) return;

  const lista = _agNaData(data);
  const [d, m, y] = data.split('/');
  const dt  = new Date(+y, +m - 1, +d);
  const nomeDia = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][dt.getDay()];

  wrap.innerHTML = `
    <div style="font-family:'Oswald',sans-serif;font-size:0.82rem;font-weight:700;
      letter-spacing:0.1em;text-transform:uppercase;color:var(--gray);
      margin-bottom:0.7rem;border-bottom:1px solid var(--border);padding-bottom:0.4rem;
      display:flex;justify-content:space-between;align-items:center">
      <span>${nomeDia}, ${data}</span>
      <span style="color:var(--red)">${lista.length} agendamento${lista.length !== 1 ? 's' : ''}</span>
    </div>`;

  if (!lista.length) {
    wrap.innerHTML += `<div class="barb-empty">
      <div class="barb-empty-icon">📅</div>
      <div class="barb-empty-txt">Nenhum agendamento neste dia</div>
    </div>`;
    return;
  }

  wrap.innerHTML += `<div class="barb-agend-list">${lista.map(_htmlCard).join('')}</div>`;
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

/* ═══════════════════════════════════════
   FOTO DO BARBEIRO — painel
═══════════════════════════════════════ */
function _painelAtualizarAvatarUI(url) {
  const emoji  = document.getElementById('painelFotoEmoji');
  const img    = document.getElementById('painelFotoImg');
  if (!img) return;
  if (url && url.startsWith('http') || (url && url.startsWith('data:'))) {
    img.src = url;
    img.style.display = 'block';
    if (emoji) emoji.style.display = 'none';
  } else {
    img.src = '';
    img.style.display = 'none';
    if (emoji) emoji.style.display = '';
    if (emoji && _barbeiro?.emoji) emoji.textContent = _barbeiro.emoji;
  }
}

window.painelUploadFoto = async function(input) {
  const file = input?.files?.[0];
  if (!file) return;
  input.value = '';

  const loading = document.getElementById('painelFotoLoading');
  const msgEl   = document.getElementById('painelFotoMsg');
  if (loading) loading.style.display = 'flex';
  if (msgEl)   { msgEl.style.color = 'var(--gray)'; msgEl.textContent = 'Enviando…'; }

  try {
    // Redimensiona para max 400px
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const MAX = 400;
          let { width: w, height: h } = img;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else        { w = Math.round(w * MAX / h); h = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => reject(new Error('Falha ao ler imagem'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });

    // Tenta Firebase Storage com timeout; fallback base64
    const fb = window._fb;
    let url  = base64;

    if (fb?.storage) {
      try {
        const path    = `barbeiros/${_barbeiro.id}/foto.jpg`;
        const blob    = await (await fetch(base64)).blob();
        const ref     = fb.storageRef(fb.storage, path);
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000));
        await Promise.race([fb.uploadBytes(ref, blob, { contentType: 'image/jpeg' }), timeout]);
        url = await fb.getDownloadURL(ref);
      } catch (storageErr) {
        console.warn('Storage falhou, usando base64:', storageErr.message);
      }
    }

    // Salva no Firestore dentro de settings/admin > barbeiros[idx].foto
    if (window._fbAuthReady) await window._fbAuthReady;
    const snap      = await fb.getDoc(fb.doc(fb.db, 'settings', 'admin'));
    const settings  = snap.exists() ? snap.data() : {};
    const barbeiros = settings.barbeiros || [];
    const idx       = barbeiros.findIndex(b => b.id === _barbeiro.id);
    if (idx < 0) throw new Error('Barbeiro não encontrado.');

    barbeiros[idx] = { ...barbeiros[idx], foto: url };
    await fb.setDoc(fb.doc(fb.db, 'settings', 'admin'), { ...settings, barbeiros }, { merge: true });

    // Atualiza local
    _barbeiro.foto = url;
    _painelAtualizarAvatarUI(url);

    if (loading) loading.style.display = 'none';
    if (msgEl)   { msgEl.style.color = '#27ae60'; msgEl.textContent = '✅ Foto atualizada com sucesso!'; }
    _mostrarToast('✅ Foto atualizada!');
    setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 4000);
  } catch (err) {
    if (loading) loading.style.display = 'none';
    if (msgEl)   { msgEl.style.color = 'var(--red)'; msgEl.textContent = '⚠️ ' + err.message; }
    _mostrarToast('❌ Erro ao enviar foto');
    console.error(err);
  }
};

window.painelRemoverFoto = async function() {
  if (!_barbeiro) return;
  const msgEl = document.getElementById('painelFotoMsg');
  try {
    const fb      = window._fb;
    if (window._fbAuthReady) await window._fbAuthReady;
    const snap    = await fb.getDoc(fb.doc(fb.db, 'settings', 'admin'));
    const settings = snap.exists() ? snap.data() : {};
    const barbeiros = settings.barbeiros || [];
    const idx = barbeiros.findIndex(b => b.id === _barbeiro.id);
    if (idx >= 0) {
      barbeiros[idx] = { ...barbeiros[idx], foto: '' };
      await fb.setDoc(fb.doc(fb.db, 'settings', 'admin'), { ...settings, barbeiros }, { merge: true });
    }
    _barbeiro.foto = '';
    _painelAtualizarAvatarUI('');
    if (msgEl) { msgEl.style.color = 'var(--gray)'; msgEl.textContent = 'Foto removida.'; }
    setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 3000);
  } catch (err) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = '⚠️ Erro ao remover.'; }
  }
};

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

/* ══════════════════════════════════════════
   FEATURE 1 — VALIDAÇÃO DE HORÁRIO vs ADM
══════════════════════════════════════════ */

function _validarHorarioBarbeiro(inicio, fim, diasAtivos) {
  const settings  = window._painelSettings || {};
  const workHours = settings.workHours || {};
  const workDays  = settings.workDays  || [];
  const NOMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const erros = [];
  diasAtivos.forEach(dia => {
    if (workDays.length && !workDays.includes(dia)) {
      erros.push(`${NOMES[dia]}: não é dia de funcionamento da barbearia`);
      return;
    }
    const h = workHours[dia] ?? workHours[String(dia)];
    if (!h) return;
    if (inicio < h.open)  erros.push(`${NOMES[dia]}: início ${inicio} antes da abertura (${h.open})`);
    if (fim   > h.close)  erros.push(`${NOMES[dia]}: fim ${fim} após o fechamento (${h.close})`);
  });
  return erros;
}

function _getShopConstraintsForDays(diasAtivos) {
  const settings  = window._painelSettings || {};
  const workHours = settings.workHours || {};
  let maxOpen = null, minClose = null;
  diasAtivos.forEach(dia => {
    const h = workHours[dia] ?? workHours[String(dia)];
    if (!h) return;
    if (!maxOpen  || h.open  > maxOpen)  maxOpen  = h.open;
    if (!minClose || h.close < minClose) minClose = h.close;
  });
  return maxOpen ? { open: maxOpen, close: minClose } : null;
}

/* ══════════════════════════════════════════
   FEATURE 2 — DIAS BLOQUEADOS (painel barbeiro)
══════════════════════════════════════════ */

async function _loadDiasBloqueados() {
  if (!window._fb || !_barbeiro) return;
  try {
    const { collection, getDocs, query, where, db } = window._fb;
    const q    = query(collection(db, 'dias_bloqueados'), where('barber_id', '==', _barbeiro.id));
    const snap = await getDocs(q);
    _diasBloqueadosPainel = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { _diasBloqueadosPainel = []; }
  _renderDiasBloqueados();
}

function _renderDiasBloqueados() {
  const lista = document.getElementById('painelBloqLista');
  const empty = document.getElementById('painelBloqEmpty');
  if (!lista) return;

  const DIAS  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const bloqueios = [..._diasBloqueadosPainel].sort((a,b) => a.date > b.date ? 1 : -1);

  lista.innerHTML = '';
  if (!bloqueios.length) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  bloqueios.forEach(item => {
    const [y,m,d] = item.date.split('-').map(Number);
    const dt      = new Date(y, m-1, d);
    const friendly = `${DIAS[dt.getDay()]}, ${String(d).padStart(2,'0')} ${MESES[m-1]} ${y}`;
    const row = document.createElement('div');
    row.className = 'bloq-painel-item';
    row.innerHTML = `
      <div class="bloq-painel-info">
        <div class="bloq-painel-data">🔒 ${friendly}</div>
        ${item.reason ? `<div class="bloq-painel-motivo">📝 ${item.reason}</div>` : ''}
      </div>
      <button class="bloq-painel-del" onclick="removerDiaBloqueadoPainel('${item.id}')">✕</button>`;
    lista.appendChild(row);
  });
}

window.adicionarDiaBloqueadoPainel = async function() {
  const dateISO = document.getElementById('painelBloqDate')?.value;
  const reason  = (document.getElementById('painelBloqReason')?.value || '').trim() || null;
  const msgEl   = document.getElementById('painelBloqMsg');

  if (!dateISO) {
    if (msgEl) { msgEl.style.color='var(--red)'; msgEl.textContent='Selecione uma data.'; }
    return;
  }
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const [y,m,d] = dateISO.split('-').map(Number);
  if (new Date(y,m-1,d) < hoje) {
    if (msgEl) { msgEl.style.color='var(--red)'; msgEl.textContent='Não é possível bloquear datas passadas.'; }
    return;
  }
  if (_diasBloqueadosPainel.some(b => b.date === dateISO)) {
    if (msgEl) { msgEl.style.color='var(--red)'; msgEl.textContent='Este dia já está bloqueado.'; }
    return;
  }

  const novoDoc = { barber_id: _barbeiro.id, date: dateISO, reason, created_at: new Date().toISOString() };
  if (window._fb) {
    try {
      if (window._fbAuthReady) await window._fbAuthReady;
      const ref = await window._fb.addDoc(window._fb.collection(window._fb.db, 'dias_bloqueados'), novoDoc);
      novoDoc.id = ref.id;
    } catch(e) {
      if (msgEl) { msgEl.style.color='var(--red)'; msgEl.textContent='Erro: '+e.message; }
      return;
    }
  } else { novoDoc.id = 'local_'+Date.now(); }

  _diasBloqueadosPainel.push(novoDoc);
  _renderDiasBloqueados();
  document.getElementById('painelBloqDate').value   = '';
  document.getElementById('painelBloqReason').value = '';
  if (msgEl) { msgEl.style.color='#27ae60'; msgEl.textContent='✅ Dia bloqueado!'; }
  setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 3000);
};

window.removerDiaBloqueadoPainel = async function(id) {
  if (!confirm('Desbloquear este dia?')) return;
  if (window._fb && !id.startsWith('local_')) {
    try {
      if (window._fbAuthReady) await window._fbAuthReady;
      await window._fb.deleteDoc(window._fb.doc(window._fb.db, 'dias_bloqueados', id));
    } catch(e) { _mostrarToast('❌ Erro: '+e.message); return; }
  }
  _diasBloqueadosPainel = _diasBloqueadosPainel.filter(b => b.id !== id);
  _renderDiasBloqueados();
  _mostrarToast('✅ Dia desbloqueado!');
};

/* ══════════════════════════════════════════
   FEATURE 3 — STORY DO BARBEIRO
══════════════════════════════════════════ */

function _initStoryTab() {
  const dataInput = document.getElementById('storyData');
  if (dataInput && !dataInput.value) dataInput.value = new Date().toISOString().split('T')[0];
  const btnComp = document.getElementById('storyBtnCompartilhar');
  if (btnComp) btnComp.style.display = !!navigator.share ? 'flex' : 'none';
}

function _storyFormatarData(iso) {
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const [y,m,d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m-1]} de ${y}`;
}

async function _getSlotsPainelBarbeiro(dataISO) {
  const [y,m,d] = dataISO.split('-');
  const dataBR  = `${d}/${m}/${y}`;
  const slots   = _gerarSlots(_barbeiro.horarioInicio||'08:00', _barbeiro.horarioFim||'18:00', _barbeiro.intervalo||60);
  const settings    = window._painelSettings || {};
  const adminBlocked = settings.takenSlots || [];
  const isBloqueado = _diasBloqueadosPainel.some(b => b.date === dataISO);
  if (isBloqueado) return [];
  const agDoDia = _agendamentos
    .filter(a => { const ad = a.data||''; return ad===dataBR || ad===dataISO; })
    .map(a => a.horario);
  return slots.filter(s => !agDoDia.includes(s) && !adminBlocked.includes(s));
}

function _storyRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function _desenharStoryBarbeiro({ dataISO, livres, promoTxt }) {
  const canvas = document.getElementById('painelStoryCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 1080;
  const COLS = 3, SLOT_W = 240, SLOT_H = 88, GAP_X = 40, GAP_Y = 20;
  const rows = Math.ceil(livres.length / COLS);
  const H = Math.max(
    820 +
    (livres.length ? rows*(SLOT_H+GAP_Y)+60 : 140) +
    (promoTxt ? 160 : 0) +
    290,
    1920
  );
  canvas.width = W; canvas.height = H;

  // Background
  ctx.fillStyle = '#0D0D0D'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(255,255,255,0.018)';
  for (let x=0;x<W;x+=40) for (let y=0;y<H;y+=40) { ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill(); }

  // Red bars
  ctx.fillStyle='#E02020'; ctx.fillRect(0,0,W,14); ctx.fillRect(0,H-14,W,14);
  ctx.fillStyle='rgba(224,32,32,0.12)'; ctx.fillRect(0,14,6,H-28);

  let curY = 60;

  // Title
  ctx.font='bold 110px "Arial Black",Arial,sans-serif'; ctx.fillStyle='#FFFFFF'; ctx.textAlign='center';
  curY+=110; ctx.fillText('BARBEARIA', W/2, curY);
  ctx.font='bold 180px "Arial Black",Arial,sans-serif'; ctx.fillStyle='#E02020';
  curY+=190; ctx.fillText('DAVI', W/2, curY);

  curY+=50; ctx.strokeStyle='#E02020'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(80,curY); ctx.lineTo(W-80,curY); ctx.stroke();

  // Barbeiro name
  curY+=90;
  ctx.font='bold 64px "Arial Black",Arial,sans-serif'; ctx.fillStyle='#FFFFFF'; ctx.textAlign='center';
  const emoji = _barbeiro.emoji || '💈';
  ctx.fillText(`${emoji}  ${(_barbeiro.nome||'').toUpperCase()}`, W/2, curY);

  // Subtitle
  curY+=70; ctx.font='bold 56px "Arial Black",Arial,sans-serif'; ctx.fillStyle='#FFFFFF';
  ctx.fillText('HORÁRIOS DISPONÍVEIS', W/2, curY);
  curY+=58; ctx.font='400 44px Arial,sans-serif'; ctx.fillStyle='#888888';
  ctx.fillText(_storyFormatarData(dataISO).toUpperCase(), W/2, curY);

  curY+=55; ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(80,curY); ctx.lineTo(W-80,curY); ctx.stroke();
  curY+=65;

  // Slots
  const blockX = (W - (COLS*SLOT_W + (COLS-1)*GAP_X)) / 2;
  if (!livres.length) {
    ctx.font='400 48px Arial,sans-serif'; ctx.fillStyle='#555555'; ctx.textAlign='center';
    ctx.fillText('Nenhum horário disponível neste dia', W/2, curY+60);
    curY+=140;
  } else {
    livres.forEach((h,i) => {
      const col=i%COLS, row=Math.floor(i/COLS);
      const sx=blockX+col*(SLOT_W+GAP_X), sy=curY+row*(SLOT_H+GAP_Y);
      ctx.fillStyle='rgba(224,32,32,0.15)'; _storyRoundRect(ctx,sx,sy,SLOT_W,SLOT_H,6); ctx.fill();
      ctx.strokeStyle='#E02020'; ctx.lineWidth=2; _storyRoundRect(ctx,sx,sy,SLOT_W,SLOT_H,6); ctx.stroke();
      ctx.font='bold 48px "Arial Black",Arial,sans-serif'; ctx.fillStyle='#FFFFFF'; ctx.textAlign='center';
      ctx.fillText(h, sx+SLOT_W/2, sy+SLOT_H/2+17);
    });
    curY += rows*(SLOT_H+GAP_Y)+40;
  }

  // Promo
  if (promoTxt) {
    curY+=20;
    ctx.fillStyle='rgba(224,32,32,0.2)'; _storyRoundRect(ctx,80,curY,W-160,110,6); ctx.fill();
    ctx.strokeStyle='#E02020'; ctx.lineWidth=3; _storyRoundRect(ctx,80,curY,W-160,110,6); ctx.stroke();
    ctx.font='bold 50px "Arial Black",Arial,sans-serif'; ctx.fillStyle='#FFFFFF'; ctx.textAlign='center';
    ctx.fillText(promoTxt.toUpperCase(), W/2, curY+73);
    curY+=150;
  }

  // Footer
  curY+=20; ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(80,curY); ctx.lineTo(W-80,curY); ctx.stroke();
  curY+=80; ctx.font='bold 52px "Arial Black",Arial,sans-serif'; ctx.fillStyle='#FFFFFF'; ctx.textAlign='center';
  ctx.fillText('BARBEARIA DO DAVI', W/2, curY);
  curY+=70; ctx.font='400 40px Arial,sans-serif'; ctx.fillStyle='#E02020';
  ctx.fillText('Agende pelo link na bio 📲', W/2, curY);

  // Instagram handle in footer
  if (_barbeiro.instagram) {
    curY+=55; ctx.font='400 38px Arial,sans-serif'; ctx.fillStyle='#888888';
    ctx.fillText(`@${_barbeiro.instagram}`, W/2, curY);
  }
}

window.gerarStoryPainel = async function() {
  const dataISO  = document.getElementById('storyData')?.value;
  const promoTxt = (document.getElementById('storyPromo')?.value||'').trim();
  if (!dataISO) { _mostrarToast('⚠️ Selecione uma data'); return; }
  _mostrarToast('⏳ Gerando Story...');
  const livres = await _getSlotsPainelBarbeiro(dataISO);
  _desenharStoryBarbeiro({ dataISO, livres, promoTxt });
  const acoes = document.getElementById('storyAcoes');
  if (acoes) acoes.style.display = 'flex';
  const ph = document.getElementById('storyPlaceholder');
  if (ph) ph.style.display = 'none';
  _mostrarToast('✅ Story gerado!');
};

window.baixarStoryPainel = function() {
  const canvas = document.getElementById('painelStoryCanvas');
  if (!canvas) return;
  const dataISO = document.getElementById('storyData')?.value || '';
  const [y,m,d] = dataISO.split('-');
  const nomeArq = `story-${(_barbeiro.nome||'barbeiro').toLowerCase().replace(/\s+/g,'_')}-${d||''}${m||''}${y||''}.png`;
  const link = document.createElement('a');
  link.download = nomeArq; link.href = canvas.toDataURL('image/png'); link.click();
  _mostrarToast('⬇️ Download iniciado!');
};

window.compartilharStoryPainel = async function() {
  const canvas = document.getElementById('painelStoryCanvas');
  if (!canvas || !navigator.share) return;
  canvas.toBlob(async blob => {
    const file = new File([blob], `story-barbearia.png`, { type: 'image/png' });
    try { await navigator.share({ files: [file], title: 'Story Barbearia do Davi' }); }
    catch(e) { if (e.name !== 'AbortError') _mostrarToast('⚠️ Compartilhamento não suportado.'); }
  }, 'image/png');
};

/* ══════════════════════════════════════════
   FEATURE 4 — INSTAGRAM DO BARBEIRO
══════════════════════════════════════════ */

window.salvarInstagramBarbeiro = async function() {
  const instaVal = (document.getElementById('painelInstagram')?.value || '').trim();
  const msgEl    = document.getElementById('painelInstagramMsg');
  let handle = instaVal;

  if (instaVal.includes('instagram.com/')) {
    const match = instaVal.match(/instagram\.com\/([^/?&#\s]+)/);
    handle = match ? match[1] : '';
  }
  handle = handle.replace(/^@/, '').trim();

  try {
    if (window._fbAuthReady) await window._fbAuthReady;
    const fb   = window._fb;
    const snap = await fb.getDoc(fb.doc(fb.db,'settings','admin'));
    const sets = snap.exists() ? snap.data() : {};
    const barbs = sets.barbeiros || [];
    const idx   = barbs.findIndex(b => b.id === _barbeiro.id);
    if (idx < 0) throw new Error('Barbeiro não encontrado.');
    barbs[idx] = { ...barbs[idx], instagram: handle };
    await fb.setDoc(fb.doc(fb.db,'settings','admin'), { ...sets, barbeiros: barbs }, { merge: true });
    _barbeiro.instagram = handle;
    const disp = document.getElementById('painelInstagramDisplay');
    if (disp) disp.textContent = handle ? `@${handle}` : '';
    if (msgEl) { msgEl.style.color='#27ae60'; msgEl.textContent = handle ? `✅ Salvo: @${handle}` : '✅ Instagram removido.'; }
    _mostrarToast('✅ Instagram atualizado!');
    setTimeout(() => { if (msgEl) msgEl.textContent=''; }, 4000);
  } catch(e) {
    if (msgEl) { msgEl.style.color='var(--red)'; msgEl.textContent='⚠️ Erro: '+e.message; }
  }
};
