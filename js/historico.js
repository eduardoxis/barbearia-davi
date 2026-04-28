/* ══════════════════════════════════════════
   HISTORICO.JS — Histórico do cliente e remarcação
   Barbearia do Davi
══════════════════════════════════════════ */

import { adminSettings, booking, cart, addToCartArr, showToast, MONTHS_PT, DAYS_SHORT_PT, parseDateBR } from './global.js';
import { buscarAgendamentosCliente } from '../routes/agendamentos.js';
import { confirmarRemarcacao, verificarPrazo24h } from '../routes/agendamentos.js';
import { gerarHorariosBarbeiro, liberarHorarioBarbeiro } from '../routes/barbeiros.js';

/* ── Estado ── */
let _histCache = [];
let _histAbaAtual = 'historico';
let _histFiltroAtual = 'todos';
let solCalAno = new Date().getFullYear();
let solCalMes = new Date().getMonth();
let solNovaData = '';
let solNovoHorario = '';
let solAgendamentoAtual = null;
// IDs deletados localmente — filtrados mesmo que o servidor demore a propagar o deleteDoc
const _deletedIds = new Set();

/* ── Carrega histórico do cliente ── */
export async function carregarHistoricoCliente() {
  const lista = document.getElementById('userHistoryList');
  if (!lista) return;
  lista.innerHTML = '<div class="hist-loading">⏳ Carregando atendimentos...</div>';
  if (!window.fbUser || !window._fb) {
    lista.innerHTML = '<div class="hist-vazio">Faça login para ver seu histórico.</div>';
    return;
  }
  _histCache = (await buscarAgendamentosCliente(window.fbUser.email, window.fbUser.name))
    .filter(a => !_deletedIds.has(a.id));
  renderHistoricoFiltrado();
}

/* ── Troca aba ── */
export function switchHistAba(aba) {
  _histAbaAtual = aba;
  _histFiltroAtual = 'todos';
  document.getElementById('histAbaHistorico')?.classList.toggle('ativa', aba === 'historico');
  document.getElementById('histAbaProximos')?.classList.toggle('ativa', aba === 'proximos');
  document.getElementById('histAbaFidelidade')?.classList.toggle('ativa', aba === 'fidelidade');
  const filtros = document.getElementById('histFiltros');
  if (filtros) filtros.style.display = aba === 'historico' ? 'flex' : 'none';
  const histList = document.getElementById('userHistoryList');
  const fidPanel = document.getElementById('fidPanel');
  if (histList) histList.style.display = aba === 'fidelidade' ? 'none' : 'block';
  if (fidPanel)  fidPanel.style.display  = aba === 'fidelidade' ? 'block' : 'none';
  if (aba === 'fidelidade') {
    import('./perfil.js').then(m => m.renderFidelidade(_histCache));
    return;
  }
  document.querySelectorAll('.hist-filtro-btn').forEach(b => b.classList.remove('ativo'));
  document.querySelectorAll('.hist-filtro-btn')[0]?.classList.add('ativo');
  renderHistoricoFiltrado();
}

/* ── Aplica filtro ── */
export function filtrarHistorico(filtro, btn) {
  _histFiltroAtual = filtro;
  document.querySelectorAll('.hist-filtro-btn').forEach(b => b.classList.remove('ativo'));
  if (btn) btn.classList.add('ativo');
  renderHistoricoFiltrado();
}

/* ── Renderiza lista ── */
function renderHistoricoFiltrado() {
  const lista  = document.getElementById('userHistoryList');
  const resumo = document.getElementById('histResumo');
  if (!lista) return;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  let dados = [..._histCache];

  if (_histAbaAtual === 'proximos') {
    dados = dados.filter(a => {
      const dt = parseDateBR(a.data);
      return dt && dt >= hoje && a.status !== 'cancelado';
    }).sort((a, b) => parseDateBR(a.data) - parseDateBR(b.data));
  } else {
    if (_histFiltroAtual === '30') {
      const lim = new Date(hoje); lim.setDate(lim.getDate()-30);
      dados = dados.filter(a => new Date(a.criadoEm || 0) >= lim);
    } else if (_histFiltroAtual === '90') {
      const lim = new Date(hoje); lim.setDate(lim.getDate()-90);
      dados = dados.filter(a => new Date(a.criadoEm || 0) >= lim);
    } else if (_histFiltroAtual === 'realizado') {
      dados = dados.filter(a => {
        const st = a.status || 'confirmado';
        const dt = parseDateBR(a.data);
        const isFuturo = dt && dt >= hoje;
        // "Realizados" = passados e não cancelados
        return !isFuturo && st !== 'cancelado' && st !== 'remarcado';
      });
    } else if (_histFiltroAtual === 'remarcado') {
      dados = dados.filter(a => (a.status || '') === 'remarcado');
    }
  }

  if (!dados.length) {
    const msg = _histAbaAtual === 'proximos' ? '📅 Nenhum agendamento futuro.' : '📋 Nenhum atendimento no período.';
    lista.innerHTML = `<div class="hist-vazio">${msg}</div>`;
    if (resumo) resumo.textContent = '';
    return;
  }

  const totalFaturado = dados.reduce((s, a) => s + parseFloat(a.total || 0), 0);
  if (resumo) resumo.textContent = dados.length + ' atendimento' + (dados.length > 1 ? 's' : '') + ' · R$ ' + totalFaturado.toFixed(0);

  lista.innerHTML = dados.map(a => renderCartaoAtendimento(a)).join('');
}

function renderCartaoAtendimento(a) {
  const status = a.status || 'confirmado';
  const statusLabel = {
    confirmado: '⏳ Agendado',
    agendado:   '⏳ Agendado',
    realizado:  '✓ Realizado',
    cancelado:  '✕ Cancelado',
    remarcado:  '🔄 Remarcado',
    pendente:   '⏳ Pendente',
  }[status] || status;
  const barbNome = a.barbeiro || '—';
  const pagamento = a.formaPagamento || 'PIX';
  // Remove base64 e URLs de ícone ANTES de separar por vírgula
  const servicos = (a.servicos || '—')
    .replace(/data:[^\s,]+;base64,[A-Za-z0-9+/=\r\n]*/g, '') // remove data URLs completas
    .replace(/https?:\/\/\S+/g, '')                           // remove http URLs
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ') || '—';
  const dt = parseDateBR(a.data);
  const ehFuturo = dt && dt >= new Date(new Date().setHours(0,0,0,0));
  const podeRemarcar = ehFuturo && status !== 'cancelado';
  return `<div class="hist-card ${status}">
    <div class="hist-card-topo">
      <div>
        <div class="hist-data">📅 ${a.data || '—'} ${a.horario ? '· 🕐 '+a.horario : ''}</div>
        <div class="hist-hora">${barbNome !== '—' ? '💈 '+barbNome : ''}</div>
      </div>
      <span class="hist-status-badge ${status}">${statusLabel}</span>
    </div>
    <div class="hist-servicos">${servicos}</div>
    <div class="hist-footer">
      <div>
        <div class="hist-valor">R$ ${parseFloat(a.total||0).toFixed(2).replace('.',',')}</div>
        <div class="hist-pagamento">${pagamento}</div>
      </div>
      <div class="hist-acoes">
        <button class="btn-hist-acao" onclick="verComprovante('${a.id}')">🧾 Comprovante</button>
        ${podeRemarcar ? `<button class="btn-hist-acao btn-hist-remarcar" onclick="remarcarDoHistorico('${a.id}')">🔄 Remarcar</button>` : ''}
        <button class="btn-hist-acao btn-hist-reagendar" onclick="reagendarDoHistorico('${a.id}')">↻ Reagendar</button>
      </div>
    </div>
  </div>`;
}

/* ── Modal de remarcação ── */
export function abrirModalRemarcacao(agendOverride) {
  const pol = adminSettings.politicaReembolso || {};
  const maxRemarc = pol.maxRemarcacoes ?? 2;
  const ag = agendOverride || { ...booking, servicos: cart.map(c => (c.icon||'') + ' ' + c.name).join(', '), total: cart.reduce((s,c) => s + c.price, 0) };
  const remarcacoesFeitas = ag.remarcacoes || 0;

  if (remarcacoesFeitas >= maxRemarc) { showToast('⚠ Limite de ' + maxRemarc + ' remarcação(ões) atingido.'); return; }
  if (!verificarPrazo24h(ag.date || ag.data, ag.time || ag.horario)) { showToast('⚠ Não é possível remarcar: faltam menos de 24 horas.'); return; }

  solAgendamentoAtual = {
    id:          ag.id || ag.firestoreId || '',
    cliente:     ag.client  || ag.cliente,
    telefone:    ag.phone   || ag.telefone,
    data:        ag.date    || ag.data,
    horario:     ag.time    || ag.horario,
    servicos:    ag.servicos,
    total:       ag.total,
    pedidoId:    ag.pedidoId || '',
    barbeiroId:  ag.barbeiroId || booking.barbeiro?.id || '',
    remarcacoes: remarcacoesFeitas,
  };

  document.getElementById('solInfoServicos').textContent = solAgendamentoAtual.servicos || '—';
  document.getElementById('solInfoData').textContent     = solAgendamentoAtual.data || '—';
  document.getElementById('solInfoHorario').textContent  = solAgendamentoAtual.horario || '—';
  document.getElementById('solInfoTotal').textContent    = 'R$ ' + solAgendamentoAtual.total;

  const restantes = maxRemarc - remarcacoesFeitas;
  const avisoEl = document.getElementById('solAvisoRemarcacao');
  if (avisoEl) { avisoEl.className = 'sol-aviso info'; avisoEl.textContent = '✅ Remarcação disponível. ' + restantes + ' restante(s).'; }

  solNovaData = ''; solNovoHorario = '';
  solCalAno = new Date().getFullYear(); solCalMes = new Date().getMonth();
  const btnConf = document.getElementById('btnConfirmarRemarcacao');
  if (btnConf) btnConf.disabled = true;
  document.getElementById('solNovaDataTexto').textContent = 'Nenhuma data selecionada';
  document.getElementById('modalSolicitacao').classList.add('show');
  renderCalSolicitacao();
}

export function fecharModalSolicitacao() {
  document.getElementById('modalSolicitacao').classList.remove('show');
}

/* ── Calendário da remarcação ── */
function renderCalSolicitacao() {
  const labelEl = document.getElementById('solCalLabel');
  if (labelEl) labelEl.textContent = MONTHS_PT[solCalMes] + ' ' + solCalAno;
  const grid = document.getElementById('solCalGrid');
  if (!grid) return;
  grid.innerHTML = '';
  DAYS_SHORT_PT.forEach(d => {
    const el = document.createElement('div'); el.className = 'cal-day-label'; el.textContent = d; grid.appendChild(el);
  });
  const firstDay    = new Date(solCalAno, solCalMes, 1).getDay();
  const daysInMonth = new Date(solCalAno, solCalMes+1, 0).getDate();
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const barbeiro = adminSettings.barbeiros?.find(b => b.id === solAgendamentoAtual?.barbeiroId);
  const diasTrabalho = barbeiro ? (barbeiro.diasAtendimento || []) : adminSettings.workDays;

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div'); el.className = 'cal-day empty'; grid.appendChild(el);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    const dt = new Date(solCalAno, solCalMes, d);
    const passado   = dt < hoje;
    const isWork    = diasTrabalho.includes(dt.getDay());
    const ds        = d.toString().padStart(2,'0') + '/' + (solCalMes+1).toString().padStart(2,'0') + '/' + solCalAno;
    const isBlocked = adminSettings.blockedDates.some(b => b.date === ds);
    const disponivel = !passado && isWork && !isBlocked;
    el.className = 'cal-day' + (passado || !isWork || isBlocked ? ' past' : '') + (dt.toDateString() === hoje.toDateString() ? ' today' : '');
    el.textContent = d;
    if (disponivel) el.onclick = () => selectDataSol(el, ds);
    if (solNovaData === ds) el.classList.add('selected');
    grid.appendChild(el);
  }
}

function selectDataSol(el, ds) {
  document.querySelectorAll('#solCalGrid .cal-day').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
  solNovaData = ds; solNovoHorario = '';
  renderHorariosSol();
  document.getElementById('solNovaDataTexto').textContent = ds + ' (horário não selecionado)';
  const btnConf = document.getElementById('btnConfirmarRemarcacao');
  if (btnConf) btnConf.disabled = true;
}

async function renderHorariosSol() {
  const grid = document.getElementById('solHorariosGrid');
  if (!grid) return;
  const barbeiro = adminSettings.barbeiros?.find(b => b.id === solAgendamentoAtual?.barbeiroId);
  const slots = barbeiro ? gerarHorariosBarbeiro(barbeiro) : adminSettings.slots;
  grid.innerHTML = '<p class="slots-empty" style="opacity:.5">Carregando horários...</p>';
  if (!slots.length) {
    grid.innerHTML = '<p class="slots-empty">Sem horários disponíveis.</p>'; return;
  }

  // Busca agendamentos do Firestore para a nova data selecionada
  let ocupados = [];
  if (solNovaData && window._fb) {
    try {
      const { collection, getDocs, query, where, db } = window._fb;
      const q = barbeiro
        ? query(collection(db, 'agendamentos'), where('data', '==', solNovaData), where('barbeiroId', '==', barbeiro.id))
        : query(collection(db, 'agendamentos'), where('data', '==', solNovaData));
      const snap = await getDocs(q);
      snap.forEach(d => { const h = d.data().horario; if (h) ocupados.push(h); });
    } catch (_) {
      ocupados = barbeiro ? (barbeiro.takenSlots || []) : adminSettings.takenSlots;
    }
  }

  grid.innerHTML = '';
  slots.forEach(slot => {
    const taken = ocupados.includes(slot) && slot !== solAgendamentoAtual?.horario;
    const el = document.createElement('div');
    el.className = 'slot' + (taken ? ' taken' : '');
    el.textContent = slot;
    if (!taken) el.onclick = () => {
      document.querySelectorAll('#solHorariosGrid .slot').forEach(s => s.classList.remove('selected'));
      el.classList.add('selected');
      solNovoHorario = slot;
      document.getElementById('solNovaDataTexto').textContent = solNovaData + ' às ' + slot;
      const btnConf = document.getElementById('btnConfirmarRemarcacao');
      if (btnConf) btnConf.disabled = false;
    };
    grid.appendChild(el);
  });
}

export function solMesAnterior() { solCalMes--; if (solCalMes < 0) { solCalMes = 11; solCalAno--; } renderCalSolicitacao(); }
export function solProximoMes()  { solCalMes++; if (solCalMes > 11) { solCalMes = 0; solCalAno++; } renderCalSolicitacao(); }

/* ── Confirma remarcação ── */
export async function confirmarSolicitacaoRemarcacao() {
  if (!solNovaData || !solNovoHorario) { showToast('⚠ Selecione data e horário!'); return; }
  const btnConf = document.getElementById('btnConfirmarRemarcacao');
  if (btnConf) { btnConf.disabled = true; btnConf.textContent = 'Processando...'; }
  const motivo = document.getElementById('solMotivoRemarcacao')?.value.trim() || '';
  try {
    const { novasFeitas, maxRemarc, novoId } = await confirmarRemarcacao({
      agendamento: solAgendamentoAtual,
      novaData:    solNovaData,
      novoHorario: solNovoHorario,
      motivo,
    });
    // Atualiza o booking com o novo ID e datas
    booking.date        = solNovaData;
    booking.time        = solNovoHorario;
    booking.remarcacoes = novasFeitas;
    if (novoId) booking.firestoreId = novoId;

    // Atualiza o cache local IMEDIATAMENTE (evita race condition com cache do Firestore)
    // Remove o agendamento antigo do cache
    _deletedIds.add(solAgendamentoAtual.id); // bloqueia o ID mesmo que servidor demore
    _histCache = _histCache.filter(x => x.id !== solAgendamentoAtual.id);
    // Insere o novo agendamento no topo do cache
    _histCache.unshift({
      ...solAgendamentoAtual,
      id:          novoId,
      data:        solNovaData,
      horario:     solNovoHorario,
      remarcacoes: novasFeitas,
      status:      'confirmado',
      criadoEm:    new Date().toISOString(),
    });

    fecharModalSolicitacao();
    atualizarTelaAposRemarcacao(solNovaData, solNovoHorario, novasFeitas, maxRemarc);
    // Renderiza IMEDIATAMENTE com o cache local já corrigido
    renderHistoricoFiltrado();
    showToast('✅ Remarcação realizada com sucesso!');
    // Aguarda 4s antes de recarregar do Firestore — dá tempo do servidor propagar
    // o deleteDoc + addDoc antes que o SDK local sirva dados frescos
    setTimeout(() => carregarHistoricoCliente(), 4000);
  } catch (e) {
    showToast('❌ Erro: ' + e.message);
    if (btnConf) { btnConf.disabled = false; btnConf.textContent = '🔄 Confirmar Remarcação'; }
  }
}

function atualizarTelaAposRemarcacao(novaData, novoHorario, feitas, max) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('confDate', novaData); set('confTime', novoHorario);
  const btn = document.getElementById('btnRemarcarPos');
  if (btn) {
    const restantes = max - feitas;
    if (restantes <= 0) {
      btn.disabled = true; btn.textContent = '✓ Limite atingido';
      btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed';
    } else {
      btn.textContent = '🔄 Remarcar Novamente (' + restantes + ' restante' + (restantes > 1 ? 's' : '') + ')';
    }
  }
}

/* ── Remarcar do histórico ── */
export function remarcarDoHistorico(id) {
  const a = _histCache.find(x => x.id === id);
  if (!a) return;
  solAgendamentoAtual = {
    id:          a.id || '',
    cliente:     a.cliente,
    telefone:    a.telefone || a.whatsapp || '',
    data:        a.data,
    horario:     a.horario,
    servicos:    a.servicos,
    total:       parseFloat(a.total || 0),
    pedidoId:    a.pedidoId || a.id,
    barbeiroId:  a.barbeiroId || '',
    remarcacoes: a.remarcacoes || 0,
  };
  import('./login.js').then(m => m.closeUserModal());
  abrirModalRemarcacao(solAgendamentoAtual);
}

/* ── Reagendar do histórico ── */
export async function reagendarDoHistorico(id) {
  const a = _histCache.find(x => x.id === id);
  if (!a) return;

  // 1. Remove o agendamento antigo do Firestore e libera o slot
  if (window._fb && a.id) {
    try {
      const { doc, deleteDoc, setDoc, db } = window._fb;
      await deleteDoc(doc(db, 'agendamentos', a.id));
      _deletedIds.add(a.id); // garante que não volta no próximo reload

      // Libera o slot do horário antigo
      if (a.barbeiroId) {
        liberarHorarioBarbeiro(a.barbeiroId, a.horario);
        await setDoc(doc(db, 'settings', 'admin'), { barbeiros: adminSettings.barbeiros || [] }, { merge: true });
      } else if (a.horario) {
        adminSettings.takenSlots = (adminSettings.takenSlots || []).filter(h => h !== a.horario);
        await setDoc(doc(db, 'settings', 'admin'), { takenSlots: adminSettings.takenSlots }, { merge: true });
      }

      // Remove do cache local para sumir do histórico imediatamente
      _histCache = _histCache.filter(x => x.id !== id);
    } catch (e) {
      console.warn('Erro ao remover agendamento antigo:', e);
    }
  }

  import('./login.js').then(m => m.closeUserModal());
  // Restaura carrinho
  window._cart = [];
  const nomes = (a.servicos || '').split(',').map(s => s.trim());
  nomes.forEach(nome => {
    const svc = adminSettings.services.find(s =>
      s.name.toLowerCase() === nome.replace(/^[^\w]+/,'').trim().toLowerCase() || nome.includes(s.name)
    );
    if (svc && !cart.find(c => c.id === svc.id)) addToCartArr({ ...svc });
  });
  if (cart.length) showToast('✓ ' + cart.length + ' serviço(s) no carrinho!');
  else showToast('⚠ Serviços não encontrados — selecione manualmente.');
  // Restaura barbeiro
  if (a.barbeiroId) {
    const barb = adminSettings.barbeiros?.find(b => b.id === a.barbeiroId);
    if (barb) booking.barbeiro = barb;
  } else if (a.barbeiro) {
    const barb = adminSettings.barbeiros?.find(b => b.nome === a.barbeiro);
    if (barb) booking.barbeiro = barb;
  }
  booking.date = ''; booking.time = '';
  const { updateCartUI, renderGallery } = await import('./index.js');
  updateCartUI(); renderGallery();
  const { renderBarbeiroGrid, goBookStep } = await import('./agendamento.js');
  renderBarbeiroGrid();
  goBookStep(booking.barbeiro ? 1 : 0);
}

/* ── Comprovante PDF do histórico ── */
export async function verComprovante(id) {
  const a = _histCache.find(x => x.id === id);
  if (!a) return;
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const W = 210, pad = 20;
    doc.setFillColor(10,10,10); doc.rect(0,0,W,297,'F');
    doc.setFillColor(224,32,32); doc.rect(0,0,W,38,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(18);
    doc.text('BARBEARIA DO DAVI', pad, 14);
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(255,200,200);
    doc.text('Vila Guará · Luziânia – GO  |  @davi_barber10', pad, 22);
    doc.setFontSize(10); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
    doc.text('COMPROVANTE DE ATENDIMENTO', pad, 31);
    let y = 50;
    const rows = [
      ['Cliente', a.cliente || '—'],
      ['Data', (a.data || '—') + (a.horario ? ' às '+a.horario : '')],
      ['Barbeiro', a.barbeiro || '—'],
      ['Serviços', a.servicos || '—'],
      ['Valor', 'R$ ' + parseFloat(a.total||0).toFixed(2).replace('.',',')],
      ['Pagamento', a.formaPagamento || 'PIX'],
      ['Status', a.status || 'realizado'],
    ];
    rows.forEach(([label, val]) => {
      doc.setFillColor(26,26,26); doc.roundedRect(pad, y, W-pad*2, 14, 1, 1, 'F');
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(224,32,32);
      doc.text(label.toUpperCase(), pad+5, y+6);
      doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(240,240,240);
      doc.text(String(val), pad+55, y+9);
      y += 16;
    });
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
    doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), W/2, 285, { align:'center' });
    doc.save('comprovante-' + (a.data || '').replace(/\//g,'-') + '.pdf');
    showToast('📄 Comprovante baixado!');
  } catch (e) { showToast('Erro ao gerar comprovante.'); }
}

/* ── Expõe globais ── */
window.switchHistAba               = switchHistAba;
window.filtrarHistorico            = filtrarHistorico;
window.abrirModalRemarcacao        = abrirModalRemarcacao;
window.fecharModalSolicitacao      = fecharModalSolicitacao;
window.solMesAnterior              = solMesAnterior;
window.solProximoMes               = solProximoMes;
window.confirmarSolicitacaoRemarcacao = confirmarSolicitacaoRemarcacao;
window.remarcarDoHistorico         = remarcarDoHistorico;
window.reagendarDoHistorico        = reagendarDoHistorico;
window.verComprovante              = verComprovante;
window.abrirModalSolicitacao       = (tipo) => { if (tipo === 'reembolso') { showToast('❌ Não há reembolso. Você pode remarcar o horário.'); return; } abrirModalRemarcacao(); };
