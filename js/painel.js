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
  if (tab === 'amanha')    _renderPainelAmanha();
  if (tab === 'semana')    _renderPainelSemana();
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

  _atualizarPreviewSlots();
}

function _atualizarPreviewSlots() {
  const inicio = document.getElementById('agendaInicio')?.value || '08:00';
  const fim    = document.getElementById('agendaFim')?.value    || '18:00';
  const slots  = _gerarSlots(inicio, fim, _agendaIntervalo);
  const wrap   = document.getElementById('agendaSlotsPreview');
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

  try {
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
