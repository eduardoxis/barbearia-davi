/* ══════════════════════════════════════════
   AGENDAMENTO.JS — Fluxo completo de agendamento
   Barbearia do Davi
══════════════════════════════════════════ */

import {
  adminSettings, booking, cart,
  showToast, MONTHS_PT, DAYS_SHORT_PT,
  saveCartToStorage, clearCartStorage,
} from './global.js';
import { gerarHorariosBarbeiro, buscarBarbeiros } from '../routes/barbeiros.js';
import { criarCheckoutCakto, gerarPedidoId, iniciarTimerPix, verificarStatusPedido } from '../routes/pagamentos.js';
import { criarAgendamento, verificarPrazo24h } from '../routes/agendamentos.js';
import { compartilharWhatsApp } from '../routes/notificacoes.js';
import { renderDestaquesThumbs, renderContadorCortes, abrirGaleriaBarbeiro } from './galeria.js';

/* ── Estado do calendário ── */
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();

let pedidoId  = null;
let pollingInt = null;
let timerInt   = null;

/* ── Renderiza seleção de barbeiro (Step 0) ── */
export function renderBarbeiroGrid() {
  const grid = document.getElementById('barbeiroGrid');
  if (!grid) return;
  const ativos = buscarBarbeiros();
  if (!ativos.length) {
    grid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--gray);font-size:0.85rem;grid-column:1/-1">Nenhum barbeiro cadastrado.</div>';
    return;
  }
  grid.innerHTML = ativos.map(b => {
    const sel      = booking.barbeiro?.id === b.id;
    const fotoHtml = b.foto
      ? `<img src="${b.foto}" alt="${b.nome}" onerror="this.parentElement.innerHTML='${b.emoji||'💈'}'">`
      : (b.emoji || '💈');
    const dias  = (b.diasAtendimento || []).map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d]).join(' · ');
    const slots = gerarHorariosBarbeiro(b);
    const fotos = b.portfolio || [];
    const temGal = fotos.length > 0;

    /* ── Prévia de fotos no card ── */
    let fotoStripHtml = '';
    if (temGal) {
      // Pega até 3 fotos: primeiro os destaques, depois as demais
      const destaques = fotos.filter(f => f.destaque);
      const resto     = fotos.filter(f => !f.destaque);
      const preview   = [...destaques, ...resto].slice(0, 3);
      const qtdExtra  = fotos.length - preview.length;

      const thumbsHtml = preview.map((f, i) => {
        const isUltimo = i === preview.length - 1 && qtdExtra > 0;
        return `<div class="barb-strip-thumb">
          <img src="${f.url}" loading="lazy" onerror="this.parentElement.classList.add('barb-strip-err')">
          ${isUltimo ? `<div class="barb-strip-mais">+${qtdExtra}</div>` : ''}
        </div>`;
      }).join('');

      fotoStripHtml = `
        <div class="barb-fotos-strip" data-barb-id="${b.id}">
          <div class="barb-strip-grid">${thumbsHtml}</div>
          <div class="barb-strip-overlay" data-barb-id="${b.id}">
            <span class="barb-strip-icone">📸</span>
            <span class="barb-strip-txt">Ver galeria · ${fotos.length} foto${fotos.length !== 1 ? 's' : ''}</span>
            <span class="barb-strip-seta">→</span>
          </div>
        </div>`;
    }

    const cortesHtml = (b.totalCortes && b.totalCortes > 0)
      ? `<div class="barb-cortes-count">✂️ ${b.totalCortes} corte${b.totalCortes !== 1 ? 's' : ''} realizados</div>`
      : '';

    return `<div class="barbeiro-card${sel ? ' selecionado' : ''}" onclick="selecionarBarbeiro('${b.id}')">
      ${sel ? '<div class="barbeiro-badge-sel">✓ Selecionado</div>' : ''}
      <div class="barbeiro-foto">${fotoHtml}</div>
      <div class="barbeiro-nome">${b.nome}</div>
      <div class="barbeiro-esp">${b.especialidade || 'Barbeiro profissional'}</div>
      ${cortesHtml}
      ${fotoStripHtml}
      <div class="barbeiro-horario">⏱ ${b.horarioInicio || '08:00'} – ${b.horarioFim || '18:00'}</div>
      <div style="font-size:0.6rem;color:var(--gray2);margin-top:0.2rem">${slots.length} horários · ${dias}</div>
      ${sel ? '<div class="barbeiro-check-circle">✓</div>' : ''}
    </div>`;
  }).join('');

  /* ── Delegação: clique no strip/overlay abre galeria sem selecionar barbeiro ── */
  grid.querySelectorAll('[data-barb-id]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const id = el.dataset.barbId;
      if (id) abrirGaleriaBarbeiro(id);
    });
  });
}

/* ══════════════════════════════════════════
   MODAL PORTFÓLIO DO BARBEIRO (cliente)
══════════════════════════════════════════ */
// Portfólio delegado para galeria.js (mantém compatibilidade)
let _portBarbeiroId = null;
export function abrirPortfolioBarbeiro(id) { abrirGaleriaBarbeiro(id); }
export function fecharPortfolio()  { if (typeof fecharGaleria  === 'function') fecharGaleria(); }
export function selecionarBarbeiroDoPortfolio() {
  if (_portBarbeiroId) { selecionarBarbeiro(_portBarbeiroId); fecharPortfolio(); showToast('💈 Barbeiro selecionado!'); }
}
export function abrirLightbox(url) { /* delegado para galeria.js */ }
export function fecharLightbox()   { if (typeof fecharLightboxGaleria === 'function') fecharLightboxGaleria(); }

export function selecionarBarbeiro(id) {
  const b = buscarBarbeiros().find(x => x.id === id);
  if (!b) return;
  booking.barbeiro = b;
  booking.date = ''; booking.time = '';
  saveCartToStorage();
  renderBarbeiroGrid();
  const hint = document.getElementById('step0Hint');
  if (hint) { hint.textContent = '✓ ' + b.nome + ' selecionado! Avançando...'; hint.style.color = '#6FCF97'; }
  setTimeout(() => goBookStep(1), 600);
}

/**
 * Versão especial chamada pelo "Quero esse corte" da galeria.
 * O carrinho já foi pré-preenchido com o serviço detectado pelas tags,
 * então pulamos a step 1 (serviços) e vamos direto para a step 2 (data/hora).
 */
export function selecionarBarbeiroComServico(id) {
  const b = buscarBarbeiros().find(x => x.id === id);
  if (!b) return;
  booking.barbeiro = b;
  booking.date = ''; booking.time = '';
  saveCartToStorage();
  renderBarbeiroGrid();
  const hint = document.getElementById('step0Hint');
  if (hint) { hint.textContent = '✓ ' + b.nome + ' selecionado! Avançando...'; hint.style.color = '#6FCF97'; }
  // Vai para dados do cliente (step 1) — serviço já está no carrinho, mas nome/WhatsApp ainda são necessários
  setTimeout(() => goBookStep(1), 600);
}

/* ── Navega entre steps ── */
export function goBookStep(n) {
  if (n > 0 && !booking.barbeiro) { showToast('⚠ Selecione um barbeiro primeiro!'); return; }
  if (n > 1 && !cart.length)      { showToast('⚠ Adicione pelo menos um serviço!'); return; }

  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.step-tab').forEach(t => {
    const s = parseInt(t.dataset.step);
    t.classList.remove('active', 'done');
    if (s < n) t.classList.add('done');
    if (s === n) t.classList.add('active');
  });
  booking.step = n;
  document.getElementById('bStep' + n)?.classList.add('active');

  // Indicador de barbeiro
  const barra = document.querySelector('.steps-bar');
  if (barra) barra.classList.toggle('pos-barbeiro', n > 0);
  if (n > 0 && booking.barbeiro) {
    const b = booking.barbeiro;
    const fotoEl = document.getElementById('barbIndFoto');
    const nomeEl = document.getElementById('barbIndNome');
    if (nomeEl) nomeEl.textContent = b.nome;
    if (fotoEl) {
      if (b.foto) fotoEl.innerHTML = `<img src="${b.foto}" alt="${b.nome}" onerror="this.parentElement.textContent='${b.emoji||'💈'}'">`;
      else fotoEl.textContent = b.emoji || '💈';
    }
  }

  if (n === 0) renderBarbeiroGrid();
  if (n === 2) { renderCalendar(); _irParaProximoDiaDisponivel(); }
  if (n === 3) { fillReview(); resetTermoCheckbox(); }
  if (n === 4) fillPayment();
  document.getElementById('agendar')?.scrollIntoView({ behavior: 'smooth' });
}

/* ── Calendário ── */
export function renderCalendar() {
  const b = booking.barbeiro;
  document.getElementById('calMonthLabel').textContent = MONTHS_PT[calMonth] + ' ' + calYear;
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  DAYS_SHORT_PT.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-label'; el.textContent = d; grid.appendChild(el);
  });
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const diasTrabalho = b ? (b.diasAtendimento || []) : adminSettings.workDays;

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div'); el.className = 'cal-day empty'; grid.appendChild(el);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    const dt = new Date(calYear, calMonth, d);
    const passado   = dt < hoje;
    const dow       = dt.getDay();
    const isWork    = diasTrabalho.includes(dow);
    const ds        = d.toString().padStart(2,'0') + '/' + (calMonth+1).toString().padStart(2,'0') + '/' + calYear;
    const dsISO     = calYear + '-' + (calMonth+1).toString().padStart(2,'0') + '-' + d.toString().padStart(2,'0');
    const isBlocked = adminSettings.blockedDates.some(bk => bk.date === ds);
    const isBarbBlocked = b
      ? (adminSettings.diasBloqueadosBarbeiro || []).some(bk => bk.barber_id === b.id && bk.date === dsISO)
      : false;
    const disponivel = !passado && isWork && !isBlocked && !isBarbBlocked;
    el.className = 'cal-day' + (passado || !isWork || isBlocked || isBarbBlocked ? ' past' : '') + (dt.toDateString() === hoje.toDateString() ? ' today' : '');
    el.textContent = d;
    if ((isBlocked || isBarbBlocked) && !passado) {
      el.style.textDecoration = 'line-through';
      el.style.color = 'rgba(224,32,32,0.4)';
      el.title = isBarbBlocked ? 'Barbeiro indisponível neste dia' : 'Fechado';
    }
    if (disponivel) el.onclick = () => selectDate(el, ds);
    if (booking.date === ds) el.classList.add('selected');
    grid.appendChild(el);
  }
}

export function prevMonth() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); }
export function nextMonth() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); }

/* ── Avança automaticamente para o próximo dia disponível ── */

/* ── Helper: renderiza ícone do serviço (emoji ou imagem) ── */
function _svcIconHtml(svc) {
  if (!svc.icon) return '';
  if (svc.icon.startsWith('data:') || svc.icon.startsWith('http')) {
    return `<img src="${svc.icon}" alt="" style="width:1.1em;height:1.1em;object-fit:cover;border-radius:2px;vertical-align:middle">`;
  }
  return svc.icon; // emoji
}
function _svcIconText(svc) {
  // Returns plain text icon (for stored strings) — never base64
  if (!svc.icon) return '';
  if (svc.icon.startsWith('data:') || svc.icon.startsWith('http')) return '🖼';
  return svc.icon;
}

function _irParaProximoDiaDisponivel() {
  // Se já há uma data selecionada e ainda é válida, não mexe
  if (booking.date) return;

  const b = booking.barbeiro;
  const diasTrabalho = b ? (b.diasAtendimento || []) : adminSettings.workDays;
  const hoje = new Date(); hoje.setHours(0,0,0,0);

  // Busca nos próximos 60 dias
  for (let offset = 0; offset < 60; offset++) {
    const dt = new Date(hoje);
    dt.setDate(hoje.getDate() + offset);
    const dow = dt.getDay();
    if (!diasTrabalho.includes(dow)) continue;

    const d   = dt.getDate().toString().padStart(2,'0');
    const m   = (dt.getMonth()+1).toString().padStart(2,'0');
    const y   = dt.getFullYear();
    const ds  = `${d}/${m}/${y}`;
    const iso = `${y}-${m}-${d}`;

    const isBlocked   = adminSettings.blockedDates.some(bk => bk.date === ds);
    const isBarbBlk   = b
      ? (adminSettings.diasBloqueadosBarbeiro || []).some(bk => bk.barber_id === b.id && bk.date === iso)
      : false;

    if (!isBlocked && !isBarbBlk) {
      // Navega o calendário para o mês correto se necessário
      if (dt.getMonth() !== calMonth || dt.getFullYear() !== calYear) {
        calMonth = dt.getMonth();
        calYear  = dt.getFullYear();
        renderCalendar();
      }
      // Destaca visualmente o próximo dia disponível (sem selecionar automaticamente)
      setTimeout(() => {
        const cells = document.querySelectorAll('#calGrid .cal-day:not(.empty):not(.past)');
        cells.forEach(cell => {
          if (parseInt(cell.textContent) === dt.getDate()) {
            cell.classList.add('next-available');
            cell.title = 'Próximo dia disponível';
          }
        });
      }, 50);
      break;
    }
  }
}

function selectDate(el, ds) {
  document.querySelectorAll('#calGrid .cal-day').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
  booking.date = ds; booking.time = '';
  saveCartToStorage();
  renderSlots().then(checkStep2);
}

/* ── Slots ── */
export async function renderSlots() {
  const b = booking.barbeiro;
  const grid = document.getElementById('slotsGrid');
  grid.innerHTML = '<p class="slots-empty" style="opacity:.5">Carregando horários...</p>';
  const slots = b ? gerarHorariosBarbeiro(b) : adminSettings.slots;
  if (!slots.length) {
    grid.innerHTML = '<p class="slots-empty">Sem horários.</p>'; return;
  }

  // Busca agendamentos do Firestore para a data e barbeiro selecionados
  let ocupados = [];
  const dataSel = booking.date;
  if (dataSel && window._fb) {
    try {
      const { collection, getDocs, query, where, db } = window._fb;
      const q = b
        ? query(collection(db, 'agendamentos'), where('data', '==', dataSel), where('barbeiroId', '==', b.id))
        : query(collection(db, 'agendamentos'), where('data', '==', dataSel));
      const snap = await getDocs(q);
      snap.forEach(d => { const h = d.data().horario; if (h) ocupados.push(h); });
    } catch (_) {
      // fallback: usa takenSlots em memória se Firestore falhar
      ocupados = b ? (b.takenSlots || []) : adminSettings.takenSlots;
    }
  }

  grid.innerHTML = '';
  const hoje = new Date();
  const d  = hoje.getDate().toString().padStart(2,'0');
  const mo = (hoje.getMonth()+1).toString().padStart(2,'0');
  const hojeStr = d + '/' + mo + '/' + hoje.getFullYear();
  const isHoje = dataSel === hojeStr;
  const horaAtual = hoje.getHours() * 60 + hoje.getMinutes();

  slots.forEach(slot => {
    const el = document.createElement('div');
    const taken = ocupados.includes(slot);
    let passado = false;
    if (isHoje) {
      const [h, m] = slot.split(':').map(Number);
      passado = (h * 60 + m) <= horaAtual;
    }
    el.className = 'slot' + (taken || passado ? ' taken' : '');
    el.textContent = slot;
    if (!taken && !passado) el.onclick = () => selectSlot(el, slot);
    if (booking.time === slot) el.classList.add('selected');
    grid.appendChild(el);
  });
}

function selectSlot(el, slot) {
  document.querySelectorAll('#slotsGrid .slot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  booking.time = slot; saveCartToStorage(); checkStep2();
}

function checkStep2() {
  const btn = document.getElementById('step2Next');
  if (btn) btn.disabled = !(booking.date && booking.time);
}

/* ── Review (step 3) ── */
function fillReview() {
  const b = booking.barbeiro;
  const name  = window.fbUser?.name  || document.getElementById('clientName')?.value.trim();
  const phone = window.fbUser?.phone || document.getElementById('clientPhone')?.value.trim();
  booking.client = name; booking.phone = phone;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sumClient', name);
  set('sumPhone',  phone);
  set('sumDate',   booking.date);
  set('sumTime',   booking.time);
  set('sumTotal',  'R$ ' + cart.reduce((s, c) => s + c.price, 0));

  // Linha do barbeiro (cria se não existir)
  let sumBarb = document.getElementById('sumBarbeiro');
  if (!sumBarb) {
    const rows = document.querySelectorAll('#bStep3 .sum-row');
    if (rows.length > 0) {
      const row = document.createElement('div');
      row.className = 'sum-row'; row.id = 'sumBarb-row';
      row.innerHTML = '<span class="sum-label">Barbeiro</span><span class="sum-val" id="sumBarbeiro">—</span>';
      rows[0].before(row);
      sumBarb = document.getElementById('sumBarbeiro');
    }
  }
  if (sumBarb) sumBarb.textContent = b ? (b.emoji || '') + ' ' + b.nome : '—';

  const svcsEl = document.getElementById('sumServices');
  if (svcsEl) svcsEl.innerHTML = cart.map(c => `<span class="service-tag">${_svcIconHtml(c)} ${c.name}</span>`).join('');
}

/* ── Termo de aceite ── */
export function verificarTermoAceito() {
  const cb  = document.getElementById('termoCheckbox');
  const btn = document.getElementById('btnIrPagamento');
  if (btn) btn.disabled = !cb?.checked;
  const aviso = document.getElementById('termoAviso');
  if (aviso && cb?.checked) aviso.classList.remove('visivel');
  document.getElementById('termoLabel')?.classList.toggle('aceito', !!cb?.checked);
}

function resetTermoCheckbox() {
  const cb  = document.getElementById('termoCheckbox');
  const btn = document.getElementById('btnIrPagamento');
  const av  = document.getElementById('termoAviso');
  const lb  = document.getElementById('termoLabel');
  if (cb)  cb.checked = false;
  if (btn) btn.disabled = true;
  if (av)  av.classList.remove('visivel');
  if (lb)  lb.classList.remove('aceito');
}

let _salvando = false; // Guard contra clique duplo

export async function irParaPagamentoComTermo() {
  // ── Proteção contra clique duplo / dupla submissão ──
  if (_salvando) return;

  const cb = document.getElementById('termoCheckbox');
  if (!cb?.checked) {
    document.getElementById('termoAviso')?.classList.add('visivel');
    showToast('⚠ Você precisa aceitar os termos para continuar!');
    return;
  }
  booking.termoAceito   = true;
  booking.termoAceitoEm = new Date().toISOString();
  booking.remarcacoes   = 0;

  // ── Leitura robusta dos dados do cliente ──
  // Prioridade: booking já preenchido → campo do formulário → fbUser
  const clienteNome =
    booking.client ||
    document.getElementById('clientName')?.value?.trim() ||
    window.fbUser?.name || '';

  const clienteTel =
    booking.phone ||
    document.getElementById('clientPhone')?.value?.trim() ||
    window.fbUser?.phone || '';

  const clienteEmail =
    window.fbUser?.email ||
    document.getElementById('clientEmail')?.value?.trim() || '';

  // ── Validação mínima antes de salvar ──
  if (!clienteNome) {
    showToast('⚠ Nome do cliente não encontrado. Volte e preencha seus dados.');
    return;
  }
  if (!booking.barbeiro?.id) {
    showToast('⚠ Barbeiro não selecionado. Volte ao início.');
    return;
  }
  if (!booking.date || !booking.time) {
    showToast('⚠ Data ou horário não selecionado.');
    return;
  }

  // ── PAGAMENTO TEMPORARIAMENTE DESABILITADO ──
  // Salva diretamente no Firestore sem passar pelo Cakto/Pix
  _salvando = true;
  const btnIr = document.getElementById('btnIrPagamento');
  if (btnIr) { btnIr.disabled = true; btnIr.textContent = 'Salvando...'; }
  try {
    if (!window._fb) throw new Error('Firebase não inicializado (window._fb ausente).');
    const { addDoc, collection, db, auth, signInAnonymously } = window._fb;
    if (!addDoc || !collection || !db) throw new Error('Firebase incompleto: addDoc/collection/db ausente.');

    // Garante autenticação — faz login anônimo se o cliente não estiver logado
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

    const agendamentoData = {
      cliente:       clienteNome,
      telefone:      clienteTel,
      email:         clienteEmail,
      servicos:      cart.map(c => (_svcIconText(c) + ' ' + c.name).trim()).join(', '),
      total:         cart.reduce((s, c) => s + c.price, 0),
      data:          booking.date,
      horario:       booking.time,
      barbeiro:      booking.barbeiro.nome,
      barbeiroId:    booking.barbeiro.id,
      formaPagamento:'SEM_PAGAMENTO',
      status:        'confirmado',
      pedidoId:      gerarPedidoId(),
      termoAceito:   booking.termoAceito,
      termoAceitoEm: booking.termoAceitoEm,
      remarcacoes:   0,
      criadoEm:      new Date().toISOString(),
    };

    console.log('[AGENDAMENTO] Tentando salvar:', agendamentoData);
    const ref = await addDoc(collection(db, 'agendamentos'), agendamentoData);
    console.log('[AGENDAMENTO] Salvo com sucesso! ID:', ref.id);

    // Bloqueia o horário no takenSlots do barbeiro (dentro de settings/admin)
    try {
      const { doc: fbDoc, setDoc: fbSetDoc, getDoc: fbGetDoc } = window._fb;
      const settingsRef = fbDoc(db, 'settings', 'admin');
      const settingsSnap = await fbGetDoc(settingsRef);
      if (settingsSnap.exists()) {
        const settingsData = settingsSnap.data();
        const barbeiros = settingsData.barbeiros || [];
        const idx = barbeiros.findIndex(b => b.id === booking.barbeiro.id);
        if (idx !== -1) {
          const novosSlots = [...new Set([...(barbeiros[idx].takenSlots || []), booking.time])];
          barbeiros[idx].takenSlots = novosSlots;
          booking.barbeiro.takenSlots = novosSlots; // atualiza em memória também
          // Atualiza adminSettings em memória para refletir imediatamente
          const { adminSettings } = await import('./global.js');
          const barbIdx = (adminSettings.barbeiros || []).findIndex(b => b.id === booking.barbeiro.id);
          if (barbIdx !== -1) adminSettings.barbeiros[barbIdx].takenSlots = novosSlots;
          await fbSetDoc(settingsRef, { barbeiros }, { merge: true });
          console.log('[AGENDAMENTO] takenSlots atualizado em settings/admin:', novosSlots);
        }
      }
    } catch (e) { console.warn('[AGENDAMENTO] Não foi possível atualizar takenSlots:', e); }

  } catch (e) {
    const msg = `ERRO AO SALVAR AGENDAMENTO\n\nCódigo: ${e?.code || 'sem código'}\nMensagem: ${e?.message || String(e)}\n\nMostre isso para o desenvolvedor.`;
    console.error('[AGENDAMENTO] Falha:', e);
    _salvando = false;
    if (btnIr) { btnIr.disabled = false; btnIr.textContent = 'Confirmar Agendamento'; }
    alert(msg); // alert garante visibilidade total
    return;
  }

  _salvando = false; // libera o guard após sucesso

  // ── Recarrega histórico do cliente para refletir o novo agendamento ──
  setTimeout(() => {
    import('./historico.js').then(m => m.carregarHistoricoCliente()).catch(() => {});
  }, 1500);

  // ── Atualiza o booking com os dados lidos para o step 5 exibir corretamente ──
  booking.client = clienteNome;
  booking.phone  = clienteTel;

  clearCartStorage(); // limpa sessão salva — agendamento concluído

  fillConfirm();
  document.querySelectorAll('.step-tab').forEach(t => { t.classList.remove('active'); t.classList.add('done'); });
  booking.step = 5;
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('bStep5')?.classList.add('active');
  document.getElementById('agendar')?.scrollIntoView({ behavior: 'smooth' });
  showToast('✅ Agendamento confirmado!');
}

/* ── Pagamento (step 4) ── */
// DESABILITADO TEMPORARIAMENTE — pagamento via Cakto será ativado em breve
function fillPayment() { /* iniciarPagamentoCakto(); */ }

async function iniciarPagamentoCakto(renovar = false) {
  clearInterval(pollingInt); clearInterval(timerInt);
  showPixState('loading');
  if (!pedidoId || renovar) pedidoId = gerarPedidoId();
  const total   = cart.reduce((s, c) => s + c.price, 0);
  const cliente = window.fbUser?.name  || document.getElementById('clientName')?.value.trim();
  const whats   = window.fbUser?.phone || document.getElementById('clientPhone')?.value.trim();

  // Preenche resumo Pix
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('pixSumTotal', total); set('pixSumDate', booking.date);
  set('pixSumTime', booking.time); set('pixSumClient', cliente);
  const svcsEl = document.getElementById('pixSumServices');
  if (svcsEl) svcsEl.innerHTML = cart.map(c => `<span class="service-tag">${_svcIconHtml(c)} ${c.name}</span>`).join('');

  try {
    const d = await criarCheckoutCakto({
      cliente, whatsapp: whats,
      servicos: cart.map(c => c.name).join(', '),
      total, data: booking.date, horario: booking.time, pedidoId,
    });
    const btn = document.getElementById('caktoCheckoutBtn');
    if (btn) btn.href = d.checkoutUrl;
    timerInt = iniciarTimerPix(15*60,
      (label, urgent) => {
        const el = document.getElementById('pixTimer');
        if (el) { el.textContent = label; el.style.color = urgent ? '#ff4444' : 'var(--red)'; }
      },
      () => { clearInterval(pollingInt); showToast('⏰ Link expirado. Gere um novo.'); }
    );
    showPixState('ready');
    pollingInt = setInterval(verificarConfirmacao, 4000);
  } catch (err) {
    const msgEl = document.getElementById('pixErrorMsg');
    if (msgEl) msgEl.textContent = err.message;
    showPixState('error');
  }
}

async function verificarConfirmacao() {
  if (!pedidoId) return;
  try {
    const d = await verificarStatusPedido(pedidoId);
    if (d.status === 'aprovado') {
      clearInterval(pollingInt); clearInterval(timerInt);

      // Overlay de confirmação
      const ov = document.createElement('div');
      ov.className = 'pix-confirmed-overlay';
      ov.innerHTML = `<div class="pix-confirmed-icon">✓</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:2.2rem;color:#fff;text-align:center">PAGAMENTO<br>CONFIRMADO!</div>
        <div style="color:#6FCF97;font-weight:600">Agendamento garantido ✓</div>`;
      document.body.appendChild(ov);

      // Salva no Firestore
      try {
        await criarAgendamento({
          cliente:      booking.client,
          telefone:     booking.phone,
          email:        window.fbUser?.email || document.getElementById('clientEmail')?.value || '',
          servicos:     cart.map(c => (_svcIconText(c) + ' ' + c.name).trim()).join(', '),
          total:        cart.reduce((s, c) => s + c.price, 0),
          data:         booking.date,
          horario:      booking.time,
          barbeiro:     booking.barbeiro?.nome || '',
          barbeiroId:   booking.barbeiro?.id || '',
          pedidoId,
          termoAceito:  booking.termoAceito,
          termoAceitoEm: booking.termoAceitoEm,
        });
      } catch (e) { console.warn('Erro ao salvar agendamento:', e); }


      setTimeout(() => {
        ov.remove();
        fillConfirm();
        document.querySelectorAll('.step-tab').forEach(t => { t.classList.remove('active'); t.classList.add('done'); });
        booking.step = 5;
        document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('bStep5')?.classList.add('active');
        document.getElementById('agendar')?.scrollIntoView({ behavior: 'smooth' });
        showToast('🎉 Pagamento confirmado!');
      }, 2400);
    }
  } catch (e) { /* aguarda próximo polling */ }
}

function showPixState(state) {
  document.getElementById('pixLoading').style.display = state === 'loading' ? 'block' : 'none';
  document.getElementById('pixReady').style.display   = state === 'ready'   ? 'block' : 'none';
  document.getElementById('pixError').style.display   = state === 'error'   ? 'block' : 'none';
  document.getElementById('pixBackBtn').style.display = state === 'loading' ? 'none' : 'flex';
}

/* ── Tela de confirmação (step 5) ── */
function fillConfirm() {
  const total = cart.reduce((s, c) => s + c.price, 0);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('confClient',   booking.client);
  set('confServices', cart.map(c => (_svcIconText(c) + ' ' + c.name).trim()).join(', '));
  set('confDate',     booking.date);
  set('confTime',     booking.time);
  set('confTotal',    'R$ ' + total);
}

/* ── PDF ── */
export function generatePDF() {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const total = cart.reduce((s, c) => s + c.price, 0);
    const W = 210, pad = 20;
    const rn = 'DAV-' + Date.now().toString().slice(-6);
    doc.setFillColor(10,10,10); doc.rect(0,0,W,297,'F');
    doc.setFillColor(224,32,32); doc.rect(0,0,W,40,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(22);
    doc.text('BARBEARIA DO DAVI', pad, 18);
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(255,200,200);
    doc.text('Vila Guará · Luziânia – GO  |  @davi_barber10', pad, 26);
    doc.setFontSize(11); doc.setTextColor(255,255,255);
    doc.text('COMPROVANTE DE AGENDAMENTO', pad, 35);
    doc.setFontSize(8); doc.setTextColor(200,200,200);
    doc.text('Nº ' + rn, W-pad, 35, { align: 'right' });
    let y = 55;
    const rows = [
      ['Cliente', booking.client],
      ['Data', booking.date + ' às ' + booking.time],
      ['Barbeiro', booking.barbeiro?.nome || '—'],
    ];
    rows.forEach(([label, val]) => {
      doc.setFillColor(26,26,26); doc.roundedRect(pad, y, W-pad*2, 14, 1, 1, 'F');
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(224,32,32);
      doc.text(label.toUpperCase(), pad+5, y+6);
      doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(240,240,240);
      doc.text(String(val), pad+55, y+9);
      y += 16;
    });
    y += 4;
    cart.forEach(svc => {
      doc.setFillColor(26,26,26); doc.roundedRect(pad, y, W-pad*2, 14, 1, 1, 'F');
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(240,240,240); doc.text(svc.name, pad+6, y+8);
      doc.setFont('helvetica','bold'); doc.setTextColor(224,32,32); doc.setFontSize(11);
      doc.text('R$ ' + svc.price, W-pad-6, y+9, { align: 'right' });
      y += 16;
    });
    y += 4;
    doc.setFillColor(224,32,32); doc.roundedRect(pad, y, W-pad*2, 18, 2, 2, 'F');
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
    doc.text('TOTAL', pad+6, y+11);
    doc.setFontSize(16); doc.text('R$ ' + total, W-pad-6, y+12, { align: 'right' });
    doc.save('comprovante-' + rn + '.pdf');
    showToast('📄 Comprovante baixado!');
  } catch (e) { showToast('Erro ao gerar PDF.'); console.error(e); }
}

/* ── WhatsApp ── */
export function shareWhatsApp() {
  compartilharWhatsApp({
    cliente:  booking.client,
    servicos: cart.map(c => c.name).join(', '),
    data:     booking.date,
    horario:  booking.time,
    total:    cart.reduce((s, c) => s + c.price, 0),
  });
}

/* ── Google Calendar ── */
export function adicionarGoogleCalendar() {
  try {
    // Converte DD/MM/YYYY → YYYYMMDD
    const [dd, mm, yyyy] = booking.date.split('/');
    const dataISO = `${yyyy}${mm}${dd}`;

    // Converte HH:MM → HHMMSS e calcula fim (+1h por padrão)
    const [hh, min] = (booking.time || '09:00').split(':').map(Number);
    const duracaoMin = 60; // duração padrão em minutos
    const fimTotalMin = hh * 60 + min + duracaoMin;
    const fimHH  = Math.floor(fimTotalMin / 60).toString().padStart(2, '0');
    const fimMin = (fimTotalMin % 60).toString().padStart(2, '0');

    const startStr = `${dataISO}T${hh.toString().padStart(2,'0')}${min.toString().padStart(2,'0')}00`;
    const endStr   = `${dataISO}T${fimHH}${fimMin}00`;

    const titulo   = `✂ Barbearia do Davi – ${cart.map(c => c.name).join(', ')}`;
    const detalhes = `Barbeiro: ${booking.barbeiro?.nome || 'Davi'}\nServiços: ${cart.map(c => c.name).join(', ')}\nTotal: R$ ${cart.reduce((s, c) => s + c.price, 0)}\n\nAgendado pelo site da Barbearia do Davi.`;
    const local    = 'Vila Guará, Luziânia – GO';

    const params = new URLSearchParams({
      action:   'TEMPLATE',
      text:     titulo,
      dates:    `${startStr}/${endStr}`,
      details:  detalhes,
      location: local,
    });

    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank');
  } catch (e) {
    showToast('Erro ao abrir o Google Calendar.');
    console.error(e);
  }
}

/* ── Resetar booking ── */
export function resetBooking() {
  const { setCart } = window._globalState || {};
  clearInterval(timerInt);
  window._cart = [];
  Object.assign(booking, { client:'', phone:'', email:'', date:'', time:'', step:0, barbeiro:null, remarcacoes:0, termoAceito:false });
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('bStep0')?.classList.add('active');
  document.querySelectorAll('.step-tab').forEach((t, i) => { t.classList.remove('active','done'); if (i === 0) t.classList.add('active'); });
  ['clientName','clientPhone','clientEmail'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const btn1 = document.getElementById('step1Next');
  if (btn1) btn1.disabled = !window.fbUser;
  import('./index.js').then(m => { m.updateCartUI(); m.renderGallery(); });
  renderBarbeiroGrid();
  document.getElementById('agendar')?.scrollIntoView({ behavior: 'smooth' });
}

/* ── Step 1: verifica campos ── */
export function checkStep1() {
  const name  = document.getElementById('clientName')?.value.trim();
  const phone = document.getElementById('clientPhone')?.value.trim();
  const btn = document.getElementById('step1Next');
  if (btn) btn.disabled = !(name && phone) && !window.fbUser;
}

/* ── Expõe globais ── */
window.abrirPortfolioBarbeiro      = abrirPortfolioBarbeiro;
window.abrirGaleriaBarbeiro        = abrirGaleriaBarbeiro;
window.fecharPortfolio             = fecharPortfolio;
window.selecionarBarbeiroDoPortfolio = selecionarBarbeiroDoPortfolio;
window.abrirLightbox               = abrirLightbox;
window.fecharLightbox              = fecharLightbox;
window.selecionarBarbeiro          = selecionarBarbeiro;
window.selecionarBarbeiroComServico = selecionarBarbeiroComServico;
window.goBookStep             = goBookStep;
window.prevMonth              = prevMonth;
window.nextMonth              = nextMonth;
window.checkStep1             = checkStep1;
window.verificarTermoAceito   = verificarTermoAceito;
window.irParaPagamentoComTermo = irParaPagamentoComTermo;
window.generatePDF            = generatePDF;
window.shareWhatsApp          = shareWhatsApp;
window.adicionarGoogleCalendar = adicionarGoogleCalendar;
window.resetBooking           = resetBooking;
window.iniciarPagamentoCakto  = iniciarPagamentoCakto;
