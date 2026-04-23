/* ══════════════════════════════════════════
   ADMIN.JS — Painel administrativo completo
   Barbearia do Davi
══════════════════════════════════════════ */

import { adminSettings, showToast, MONTHS_PT, DAYS_SHORT_PT, DAYS_FULL } from './global.js';
import {
  renderPortfolioAdmin,
  adicionarFotoPortfolio,
  removerFotoPortfolio,
  triggerUploadFoto,
  onPortFileChange,
  toggleDestaquePortfolio,
  atualizarLimitePortfolio,
  abrirEditarTagsFoto,
  galeAdmDragStart, galeAdmDragOver, galeAdmDrop, galeAdmDragEnd,
  incrementarContadorCortes,
} from './galeria.js';
import { buscarTodosAgendamentos, buscarAgendamentosDoDia } from '../routes/agendamentos.js';
import { gerarHorariosBarbeiro } from '../routes/barbeiros.js';
import { agruparPorCliente, diasDesde, intervaloMedio, rankServicos, salvarObservacao, carregarObservacoes, CRM_INATIVO_DIAS, CRM_VIP_VISITAS } from '../routes/clientes.js';

/* ── Estado calendário de atendimentos ── */
let atendAno = new Date().getFullYear();
let atendMes = new Date().getMonth();
let atendData = '';
let atendBarbeiroId   = null;
let atendBarbeiroNome = '';

/* ── Abre/fecha admin ── */
export function openAdmin(skipLogin = false) {
  document.getElementById('admin-panel').classList.add('show');
  document.body.style.overflow = 'hidden';
  if (skipLogin) {
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminDash').style.display = 'block';
    loadAdminSettings();
  }
}

export function closeAdmin() {
  document.getElementById('admin-panel').classList.remove('show');
  document.body.style.overflow = '';
  document.getElementById('adminLogin').style.display = 'block';
  document.getElementById('adminDash').style.display = 'none';
  document.getElementById('adminEmail').value = '';
  document.getElementById('adminPass').value = '';
  document.getElementById('adminErr').classList.remove('show');
}

export async function doAdminLogin() {
  const email = document.getElementById('adminEmail').value.trim();
  const pass  = document.getElementById('adminPass').value;
  if (email === 'davibarber@gmail.com' && pass === 'davi4452') {
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminDash').style.display  = 'block';
    await loadAdminSettings();
  } else {
    document.getElementById('adminErr').classList.add('show');
    document.getElementById('adminPass').value = '';
  }
}

export function adminLogout() {
  closeAdmin();
}

/* ── Carrega configurações ── */
export async function loadAdminSettings() {
  let tentativas = 0;
  while (!window._fb && tentativas < 30) { await new Promise(r => setTimeout(r, 100)); tentativas++; }
  if (!window._fb) { renderAdminDash(); return; }
  try {
    const snap = await window._fb.getDoc(window._fb.doc(window._fb.db, 'settings', 'admin'));
    if (snap.exists()) {
      const d = snap.data();
      const keys = ['shopOpen','workDays','workHours','takenSlots','blockedDates','duracaoPadrao','politicaReembolso','barbeiros','services'];
      keys.forEach(k => { if (d[k] !== undefined) adminSettings[k] = d[k]; });
      if (d.slots !== undefined) {
        const antigos45 = ['08:45','09:30','10:15','13:45'];
        adminSettings.slots = d.slots.some(s => antigos45.includes(s))
          ? ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']
          : d.slots;
      }
    }
  } catch (e) { console.error('Erro ao carregar config:', e); }
  if (!adminSettings.duracaoPadrao) adminSettings.duracaoPadrao = 60;
  adminSettings.services = adminSettings.services.map(s => ({ ...s, time: '1h' }));
  renderAdminDash();
  carregarBloqueiosBarb();
  import('./index.js').then(m => { m.renderGallery(); m.updateCartUI(); });
  import('./global.js').then(m => m.updateHeroStatus());
}

/* ── Salva configurações ── */
export async function saveAdminSettings() {
  const btn = document.getElementById('globalSaveBtn');
  try {
    await window._fb.setDoc(window._fb.doc(window._fb.db, 'settings', 'admin'), {
      shopOpen: adminSettings.shopOpen, workDays: adminSettings.workDays,
      workHours: adminSettings.workHours, slots: adminSettings.slots,
      takenSlots: adminSettings.takenSlots, blockedDates: adminSettings.blockedDates,
      services: adminSettings.services, duracaoPadrao: adminSettings.duracaoPadrao,
      politicaReembolso: adminSettings.politicaReembolso, barbeiros: adminSettings.barbeiros,
    });
    if (btn) { btn.textContent = '✓ Salvo!'; btn.classList.add('saved'); }
    showToast('💾 Configurações salvas!');
    // Backup automático
    const dados = gerarDadosBackup();
    salvarBackupFirestore(dados);
  } catch (e) {
    showToast('❌ Erro ao salvar: ' + e.message);
  } finally {
    setTimeout(() => { if (btn) { btn.textContent = '💾 Salvar tudo'; btn.classList.remove('saved'); } }, 2000);
  }
}

function renderAdminDash() {
  renderAdminDays();
  renderAdminSlots();
  renderAdminServices();
  renderBarbeirosAdmin();
  updateAdminStats();
  updateShopStatusUI();
  renderFuncionamento();
  renderBlockedDates();
  import('./global.js').then(m => m.updateHeroStatus());
}

/* ── Tabs ── */
export function switchAdmTab(tab) {
  const tabs = ['dashboard','barbeiros','status','funcionamento','dias','horarios','servicos','atendimentos','historico','backup','solicitacoes','clientes','instagram'];
  document.querySelectorAll('.adm-tab').forEach((t, i) => t.classList.toggle('active', tabs[i] === tab));
  document.querySelectorAll('.adm-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('admTab-' + tab)?.classList.add('active');
  if (tab === 'funcionamento') renderFuncionamento();
  if (tab === 'dias')          renderBloqueiosBarb();
  if (tab === 'atendimentos')  { trocarBarbeiro(); }
  if (tab === 'historico')     trocarBarbeiroHistorico();
  if (tab === 'backup')        carregarHistoricoBackup();
  if (tab === 'solicitacoes')  { carregarSolicitacoes(); carregarPoliticaReembolsoForm(); }
  if (tab === 'dashboard')     carregarDashboard();
  if (tab === 'barbeiros')     renderBarbeirosAdmin();
  if (tab === 'clientes')      carregarCRM();
  if (tab === 'instagram')     renderInstagramTab();
}

/* ── Stats ── */
function updateAdminStats() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stTotalSvc', adminSettings.services.filter(s => !s.hidden).length);
  set('stWorkDays', adminSettings.workDays.length);
  set('stSlots',    adminSettings.slots.length);
  set('stBlocked',  adminSettings.takenSlots.length);
}

/* ── Status ── */
export function toggleShopStatus() {
  adminSettings.shopOpen = document.getElementById('shopOpenToggle').checked;
  updateShopStatusUI();
  import('./global.js').then(m => m.updateHeroStatus());
  showToast(adminSettings.shopOpen ? '🟢 ABERTA' : '⚫ FECHADA');
}

function updateShopStatusUI() {
  const open = adminSettings.shopOpen;
  const toggle = document.getElementById('shopOpenToggle');
  if (toggle) toggle.checked = open;
  const title = document.getElementById('statusToggleTitle');
  const sub   = document.getElementById('statusToggleSub');
  if (title) title.textContent = open ? '🟢 Aberto Agora' : '⚫ Fechado no Momento';
  if (sub)   sub.textContent   = open ? 'A barbearia está recebendo clientes' : 'A barbearia está fechada';
}

/* ── Funcionamento ── */
function renderFuncionamento() {
  const grid = document.getElementById('funcionamentoGrid');
  if (!grid) return;
  grid.className = 'func-grid'; grid.innerHTML = '';
  DAYS_FULL.forEach((name, i) => {
    const isActive = adminSettings.workDays.includes(i);
    const h = adminSettings.workHours[i] || { open:'08:00', close:'18:00' };
    const row = document.createElement('div');
    row.className = 'func-row' + (isActive ? ' active-day' : ' inactive-day');
    row.innerHTML = `<div class="func-day-info">
      <div class="func-day-name">${name}</div>
      <div class="func-day-status ${isActive?'open':'closed'}">${isActive?'✓ Ativo':'✕ Fechado'}</div>
    </div>
    <div>${isActive ? `<div class="func-times">
      <div class="func-time-group"><span class="func-time-label">Abre às</span>
        <input class="func-time-input" type="time" value="${h.open}" onchange="updateWorkHour(${i},'open',this.value)"></div>
      <span class="func-time-sep">→</span>
      <div class="func-time-group"><span class="func-time-label">Fecha às</span>
        <input class="func-time-input" type="time" value="${h.close}" onchange="updateWorkHour(${i},'close',this.value)"></div>
    </div>` : `<span style="font-size:0.8rem;color:var(--gray2);font-style:italic">Ative na aba Dias</span>`}</div>`;
    grid.appendChild(row);
  });
}

export function updateWorkHour(dayIndex, field, value) {
  if (!adminSettings.workHours[dayIndex]) adminSettings.workHours[dayIndex] = { open:'08:00', close:'18:00' };
  adminSettings.workHours[dayIndex][field] = value;
}

/* ── Dias ── */
function renderAdminDays() {
  const grid = document.getElementById('adminDaysGrid');
  if (!grid) return;
  grid.innerHTML = '';
  DAYS_FULL.forEach((name, i) => {
    const on = adminSettings.workDays.includes(i);
    const card = document.createElement('div');
    card.className = 'day-big-card' + (on ? ' on' : '');
    card.innerHTML = `<span class="day-abbr">${DAYS_SHORT_PT[i]}</span><span class="day-name">${name}</span><div class="day-dot"></div>`;
    card.onclick = () => {
      if (adminSettings.workDays.includes(i)) adminSettings.workDays = adminSettings.workDays.filter(x => x !== i);
      else adminSettings.workDays.push(i);
      card.classList.toggle('on', adminSettings.workDays.includes(i));
      updateAdminStats();
      if (document.getElementById('admTab-funcionamento')?.classList.contains('active')) renderFuncionamento();
    };
    grid.appendChild(card);
  });
}

/* ── Blocked Dates ── */
function renderBlockedDates() {
  const list  = document.getElementById('blockedDatesList');
  const empty = document.getElementById('blockedDatesEmpty');
  if (!list) return;
  list.innerHTML = '';
  const bd = adminSettings.blockedDates;
  if (empty) empty.style.display = bd.length ? 'none' : 'block';
  [...bd].sort((a, b) => {
    const pa = a.date.split('/'), pb = b.date.split('/');
    return new Date(pa[2],pa[1]-1,pa[0]) - new Date(pb[2],pb[1]-1,pb[0]);
  }).forEach(item => {
    const row = document.createElement('div');
    row.className = 'blocked-date-item';
    const parts = item.date.split('/');
    const dt = new Date(parts[2], parts[1]-1, parts[0]);
    const dayNames   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const friendly = dayNames[dt.getDay()] + ', ' + parts[0] + ' ' + monthNames[dt.getMonth()] + ' ' + parts[2];
    row.innerHTML = `<div class="blocked-date-info">
      <span class="blocked-date-tag">🔒 ${friendly}</span>
      <span class="blocked-date-reason">${item.reason ? '📝 '+item.reason : '<em style="color:var(--gray2)">Sem motivo</em>'}</span>
    </div>
    <button class="blocked-date-del" onclick="removeBlockedDate('${item.date}')">✕</button>`;
    list.appendChild(row);
  });
}

export function openAddBlockedDate() {
  document.getElementById('blockedDateErr').classList.remove('show');
  document.getElementById('blockedDateReason').value = '';
  document.getElementById('blockedDateInput').min = new Date().toISOString().split('T')[0];
  document.getElementById('blockedDateInput').value = '';
  document.getElementById('addBlockedDateOverlay').classList.add('show');
}
export function closeAddBlockedDate() { document.getElementById('addBlockedDateOverlay').classList.remove('show'); }
export function confirmAddBlockedDate() {
  const raw    = document.getElementById('blockedDateInput').value;
  const reason = document.getElementById('blockedDateReason').value.trim();
  if (!raw) { document.getElementById('blockedDateErr').textContent='Escolha uma data.'; document.getElementById('blockedDateErr').classList.add('show'); return; }
  const [y,m,d] = raw.split('-');
  const ds = d+'/'+m+'/'+y;
  if (adminSettings.blockedDates.find(b => b.date === ds)) {
    document.getElementById('blockedDateErr').textContent='Esta data já está bloqueada.'; document.getElementById('blockedDateErr').classList.add('show'); return;
  }
  adminSettings.blockedDates.push({ date: ds, reason });
  renderBlockedDates(); closeAddBlockedDate(); showToast('🔒 ' + ds + ' bloqueado!');
}
export function removeBlockedDate(ds) {
  adminSettings.blockedDates = adminSettings.blockedDates.filter(b => b.date !== ds);
  renderBlockedDates(); showToast('✓ Bloqueio de ' + ds + ' removido.');
}

/* ── Slots ── */
function renderAdminSlots() {
  const grid = document.getElementById('adminSlotsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const dur = adminSettings.duracaoPadrao || 60;
  const durLabel = dur >= 60 ? (dur === 60 ? '1h' : (dur/60).toFixed(1).replace('.0','')+'h') : dur+'min';
  const sel = document.getElementById('selectDuracaoPadrao');
  if (sel) sel.value = String(dur);
  const labelEl = document.getElementById('labelDuracaoAtual');
  if (labelEl) labelEl.textContent = durLabel + ' (' + dur + ' min)';
  [...adminSettings.slots].sort().forEach(slot => {
    const blocked = adminSettings.takenSlots.includes(slot);
    const card = document.createElement('div');
    card.className = 'slot-manage-card' + (blocked ? ' blocked' : '');
    card.innerHTML = `<span class="slot-time">${slot}</span>
      <span style="font-size:0.58rem;color:var(--gray2)">⏱ ${durLabel}</span>
      <span class="slot-status-badge ${blocked?'blocked':'ok'}">${blocked?'🔴 Bloqueado':'🟢 Livre'}</span>
      <div class="slot-actions">
        <button class="slot-toggle-btn" onclick="toggleSlot('${slot}',this)">${blocked?'Liberar':'Bloquear'}</button>
        <button class="slot-del-btn" onclick="deleteSlot('${slot}')">✕</button>
      </div>`;
    grid.appendChild(card);
  });
  updateAdminStats();
}

export function aplicarDuracaoPadrao() {
  const novasDuracao = parseInt(document.getElementById('selectDuracaoPadrao')?.value);
  adminSettings.duracaoPadrao = novasDuracao;
  const todosSlots = new Set();
  adminSettings.workDays.forEach(dia => {
    const h = adminSettings.workHours[dia] || { open:'08:00', close:'18:00' };
    const [hI, mI] = h.open.split(':').map(Number);
    const [hF, mF] = h.close.split(':').map(Number);
    let t = hI * 60 + mI;
    const fim = hF * 60 + mF;
    while (t + novasDuracao <= fim) {
      todosSlots.add(String(Math.floor(t/60)).padStart(2,'0') + ':' + String(t%60).padStart(2,'0'));
      t += novasDuracao;
    }
  });
  if (todosSlots.size > 0) {
    adminSettings.slots = [...todosSlots].sort();
    adminSettings.takenSlots = adminSettings.takenSlots.filter(s => adminSettings.slots.includes(s));
  }
  renderAdminSlots();
  showToast('⏱ ' + novasDuracao + ' min → ' + adminSettings.slots.length + ' horários. Clique em Salvar tudo.');
}

export function toggleSlot(slot, btn) {
  const card  = btn.closest('.slot-manage-card');
  const badge = card.querySelector('.slot-status-badge');
  if (adminSettings.takenSlots.includes(slot)) {
    adminSettings.takenSlots = adminSettings.takenSlots.filter(s => s !== slot);
    card.classList.remove('blocked'); badge.className = 'slot-status-badge ok'; badge.textContent = '🟢 Livre'; btn.textContent = 'Bloquear';
  } else {
    adminSettings.takenSlots.push(slot);
    card.classList.add('blocked'); badge.className = 'slot-status-badge blocked'; badge.textContent = '🔴 Bloqueado'; btn.textContent = 'Liberar';
  }
  updateAdminStats();
}
export function deleteSlot(slot) {
  if (!confirm('Remover ' + slot + '?')) return;
  adminSettings.slots = adminSettings.slots.filter(s => s !== slot);
  adminSettings.takenSlots = adminSettings.takenSlots.filter(s => s !== slot);
  renderAdminSlots(); showToast('🗑 ' + slot + ' removido.');
}
export function openAddSlotModal()  { document.getElementById('slotErr').classList.remove('show'); document.getElementById('addSlotOverlay').classList.add('show'); }
export function closeAddSlotModal() { document.getElementById('addSlotOverlay').classList.remove('show'); }
export function confirmAddSlot() {
  const v = document.getElementById('newSlotInput').value;
  if (!v) return;
  if (adminSettings.slots.includes(v)) { document.getElementById('slotErr').classList.add('show'); return; }
  adminSettings.slots.push(v); renderAdminSlots(); closeAddSlotModal(); showToast('✓ ' + v + ' adicionado!');
}

/* ── Serviços ── */
function renderAdminServices(filtro = '') {
  const list = document.getElementById('adminServicesList');
  if (!list) return;
  list.innerHTML = '';

  const termo = filtro.trim().toLowerCase();
  const todos  = adminSettings.services;
  const visiveis = todos.filter(s => !termo || s.name.toLowerCase().includes(termo) || (s.desc||'').toLowerCase().includes(termo));

  // Atualiza barra de contagem
  const countBar = document.getElementById('svcCountBar');
  if (countBar) {
    const ativos   = todos.filter(s => !s.hidden).length;
    const ocultos  = todos.filter(s => s.hidden).length;
    countBar.innerHTML =
      `<span class="svc-count-item">Total: <strong>${todos.length}</strong></span>` +
      `<span class="svc-count-sep">·</span>` +
      `<span class="svc-count-item svc-count-ativo">Visíveis: <strong>${ativos}</strong></span>` +
      (ocultos ? `<span class="svc-count-sep">·</span><span class="svc-count-item svc-count-oculto">Ocultos: <strong>${ocultos}</strong></span>` : '') +
      (termo ? `<span class="svc-count-sep">·</span><span class="svc-count-item">Encontrados: <strong>${visiveis.length}</strong></span>` : '');
  }

  if (!visiveis.length) {
    list.innerHTML = `<div class="atend-sem-data">${termo ? 'Nenhum serviço encontrado para +filtro+.' : 'Nenhum serviço cadastrado.'}</div>`;
    updateAdminStats(); return;
  }

  visiveis.forEach(svc => {
    const row = document.createElement('div');
    row.className = 'svc-editor-card' + (svc.hidden ? ' hidden-svc' : '');
    const iconHtml = svc.icon && (svc.icon.startsWith('http') || svc.icon.startsWith('data:'))
      ? `<img src="${svc.icon}" class="svc-ed-icon-img" alt="${svc.name}" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
        + `<div class="svc-ed-icon" style="display:none">✂️</div>`
      : `<div class="svc-ed-icon">${svc.icon || '✂️'}</div>`;
    row.innerHTML = `${iconHtml}
      <div class="svc-ed-info">
        <div class="svc-ed-name">${svc.name}${svc.hidden ? ' <span class="svc-badge-oculto">oculto</span>' : ''}</div>
        <div class="svc-ed-desc">${svc.desc || '—'}</div>
        <div class="svc-ed-meta">
          <span class="svc-ed-tag svc-ed-price">R$ ${svc.price}</span>
          <span class="svc-ed-tag svc-ed-time">⏱ ${svc.time}</span>
        </div>
      </div>
      <div class="svc-ed-actions">
        <button class="svc-ed-btn" onclick="openEditSvcModal('${svc.id}')">✏ Editar</button>
        <button class="svc-ed-btn" onclick="toggleSvcVis('${svc.id}')">${svc.hidden?'👁 Mostrar':'🙈 Ocultar'}</button>
        <button class="svc-ed-btn svc-ed-btn-del" onclick="deleteSvc('${svc.id}')">🗑 Excluir</button>
      </div>`;
    list.appendChild(row);
  });
  updateAdminStats();
}

export function filtrarServicosAdmin() {
  const termo = document.getElementById('svcSearchInput')?.value || '';
  renderAdminServices(termo);
}

export function toggleSvcVis(id) {
  const svc = adminSettings.services.find(s => s.id === id); if (!svc) return;
  svc.hidden = !svc.hidden; renderAdminServices();
  import('./index.js').then(m => m.renderGallery());
  showToast(svc.hidden ? '🙈 Ocultado' : '👁 Visível');
}
export function deleteSvc(id) {
  const svc = adminSettings.services.find(s => s.id === id);
  if (!svc || !confirm('Remover "' + svc.name + '"?')) return;
  adminSettings.services = adminSettings.services.filter(s => s.id !== id);
  renderAdminServices(); import('./index.js').then(m => m.renderGallery()); showToast('🗑 Removido.');
}

let editingSvcId   = null;
let _svcFotoFile   = null;   // File selecionado (ainda não enviado)
let _svcFotoObjUrl = null;   // URL.createObjectURL para preview
let _svcFotoUrl    = null;   // URL final (Firebase Storage ou existente)

/* ─── Redimensionamento de imagem via Canvas ─── */
async function resizeImage(file, maxPx) {
  return new Promise((resolve) => {
    if (!maxPx || maxPx === 0) { resolve(file); return; }
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w <= maxPx && h <= maxPx) { resolve(file); return; }
      const scale  = Math.min(maxPx / w, maxPx / h);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(blob => {
        const resized = new File([blob], file.name, { type: mimeType });
        resolve(resized);
      }, mimeType, 0.88);
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
    img.src = objUrl;
  });
}

/* ─── Seleção de foto ─── */
export function svcFotoSelecionada(input) {
  const file = input.files && input.files[0];
  document.getElementById('svcFotoErr').classList.remove('show');
  if (!file) return;
  if (!['image/jpeg','image/png'].includes(file.type)) {
    document.getElementById('svcFotoErr').classList.add('show');
    input.value = '';
    return;
  }
  // Revoga objectURL anterior para liberar memória
  if (_svcFotoObjUrl) URL.revokeObjectURL(_svcFotoObjUrl);
  _svcFotoFile   = file;
  _svcFotoObjUrl = URL.createObjectURL(file);
  _svcFotoUrl    = null; // será definido após upload
  _svcMostrarPreview(_svcFotoObjUrl);
  // Mostrar seletor de tamanho
  const rw = document.getElementById('svcFotoResizeWrap');
  if (rw) rw.style.display = 'flex';
}

export function removerFotoSvc() {
  if (_svcFotoObjUrl) URL.revokeObjectURL(_svcFotoObjUrl);
  _svcFotoFile   = null;
  _svcFotoObjUrl = null;
  _svcFotoUrl    = null;
  document.getElementById('svcFotoInput').value = '';
  document.getElementById('svcFotoPreview').style.display  = 'none';
  document.getElementById('svcFotoPreview').src            = '';
  document.getElementById('svcFotoPlaceholder').style.display = 'flex';
  document.getElementById('svcFotoAcoes').style.display    = 'none';
  const rw = document.getElementById('svcFotoResizeWrap');
  if (rw) rw.style.display = 'none';
}

function _svcMostrarPreview(src) {
  const img  = document.getElementById('svcFotoPreview');
  img.src    = src;
  img.style.display = 'block';
  document.getElementById('svcFotoPlaceholder').style.display = 'none';
  document.getElementById('svcFotoAcoes').style.display       = 'flex';
}

function _svcResetFoto() {
  if (_svcFotoObjUrl) URL.revokeObjectURL(_svcFotoObjUrl);
  _svcFotoFile   = null;
  _svcFotoObjUrl = null;
  _svcFotoUrl    = null;
  const inp = document.getElementById('svcFotoInput');
  if (inp) inp.value = '';
  const img = document.getElementById('svcFotoPreview');
  if (img) { img.style.display = 'none'; img.src = ''; }
  const ph = document.getElementById('svcFotoPlaceholder');
  if (ph) ph.style.display = 'flex';
  const ac = document.getElementById('svcFotoAcoes');
  if (ac) ac.style.display = 'none';
  const rw = document.getElementById('svcFotoResizeWrap');
  if (rw) rw.style.display = 'none';
  const err = document.getElementById('svcFotoErr');
  if (err) err.classList.remove('show');
}

export function openAddSvcModal() {
  editingSvcId = null;
  document.getElementById('svcModalTitle').textContent = '+ Novo Serviço';
  ['svcIcon','svcName','svcDesc','svcTime'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('svcTime').value  = '30min';
  document.getElementById('svcPrice').value = '';
  document.getElementById('svcErr').classList.remove('show');
  _svcResetFoto();
  document.getElementById('addSvcOverlay').classList.add('show');
}

export function openEditSvcModal(id) {
  editingSvcId = id;
  const svc = adminSettings.services.find(s => s.id === id); if (!svc) return;
  document.getElementById('svcModalTitle').textContent = '✏ Editar Serviço';
  document.getElementById('svcIcon').value  = svc.icon || '';
  document.getElementById('svcName').value  = svc.name;
  document.getElementById('svcDesc').value  = svc.desc || '';
  document.getElementById('svcPrice').value = svc.price;
  document.getElementById('svcTime').value  = svc.time;
  document.getElementById('svcErr').classList.remove('show');
  _svcResetFoto();
  // Se o serviço já tem foto, exibir preview
  if (svc.icon && (svc.icon.startsWith('http') || svc.icon.startsWith('data:'))) {
    _svcFotoUrl = svc.icon;
    _svcMostrarPreview(svc.icon);
  }
  document.getElementById('addSvcOverlay').classList.add('show');
}

export function closeAddSvcModal() { document.getElementById('addSvcOverlay').classList.remove('show'); }

export async function confirmSaveService() {
  const name  = document.getElementById('svcName').value.trim();
  const price = parseFloat(document.getElementById('svcPrice').value);
  if (!name || isNaN(price)) { document.getElementById('svcErr').classList.add('show'); return; }
  document.getElementById('svcErr').classList.remove('show');

  const desc = document.getElementById('svcDesc').value.trim();
  const time = document.getElementById('svcTime').value.trim() || '30min';

  // ── Upload de foto se houver arquivo novo ──
  let icon = _svcFotoUrl || document.getElementById('svcIcon').value || '✂️';
  if (_svcFotoFile) {
    const loading   = document.getElementById('svcFotoLoading');
    const btn       = document.getElementById('svcSalvarBtn');
    const uploadErr = document.getElementById('svcFotoUploadErr');
    if (uploadErr) { uploadErr.textContent = ''; uploadErr.classList.remove('show'); }
    if (loading) loading.style.display = 'flex';
    if (btn)     btn.disabled = true;
    try {
      // Redimensionar antes do upload (800px para garantir tamanho menor)
      const maxPx   = parseInt(document.getElementById('svcFotoResizeOpt')?.value || '800') || 800;
      const arquivo = await resizeImage(_svcFotoFile, maxPx);

      // Tentar Firebase Storage primeiro
      let uploadOk = false;
      const fb = window._fb;
      if (fb?.storage) {
        try {
          const svcId  = editingSvcId || ('svc_' + Date.now());
          const ext    = arquivo.type === 'image/png' ? 'png' : 'jpg';
          const path   = `servicos/${svcId}.${ext}`;
          const ref    = fb.storageRef(fb.storage, path);
          const uploadPromise  = fb.uploadBytes(ref, arquivo, { contentType: arquivo.type });
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 15000)
          );
          await Promise.race([uploadPromise, timeoutPromise]);
          icon      = await fb.getDownloadURL(ref);
          uploadOk  = true;
        } catch(storageErr) {
          console.warn('Firebase Storage falhou, usando base64:', storageErr.code || storageErr.message);
        }
      }

      // Fallback: salvar como base64 direto no Firestore
      if (!uploadOk) {
        icon = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = e => resolve(e.target.result);
          reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
          reader.readAsDataURL(arquivo);
        });
      }

      _svcFotoUrl  = icon;
      _svcFotoFile = null;
    } catch(err) {
      console.error('Erro ao processar foto:', err);
      if (uploadErr) { uploadErr.textContent = '⚠ ' + (err.message || 'Erro ao processar foto.'); uploadErr.classList.add('show'); }
    } finally {
      if (loading) loading.style.display = 'none';
      if (btn)     btn.disabled = false;
    }
  }

  if (editingSvcId) {
    const svc = adminSettings.services.find(s => s.id === editingSvcId);
    if (svc) Object.assign(svc, { icon, name, desc, price, time });
  } else {
    adminSettings.services.push({ id:'svc_'+Date.now(), name, desc, price, time, icon, bg:'gi-corte', hidden:false });
  }
  closeAddSvcModal(); renderAdminServices(); import('./index.js').then(m => m.renderGallery());
  await saveAdminSettings();
}

/* ── Barbeiros Admin ── */
let _barbEmojiSelecionado = '💈';

export function renderBarbeirosAdmin() {
  const lista = document.getElementById('listaBarbeirosAdmin');
  if (!lista) return;
  const barbs = adminSettings.barbeiros || [];
  if (!barbs.length) { lista.innerHTML = '<div class="atend-sem-data">Nenhum barbeiro cadastrado.</div>'; return; }
  lista.innerHTML = barbs.map(b => {
    const dias  = (b.diasAtendimento||[]).map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d]).join(', ');
    const slots = gerarHorariosBarbeiro(b);
    const fotoHtml = b.foto ? `<img src="${b.foto}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.textContent='${b.emoji||'💈'}'">` : (b.emoji||'💈');
    return `<div class="barb-editor-card${b.ativo===false?' inativo':''}">
      <div class="barb-ed-foto">${fotoHtml}</div>
      <div class="barb-ed-info">
        <div class="barb-ed-nome">${b.nome} <span class="barbeiro-status-badge ${b.ativo!==false?'ativo':'inativo'}">${b.ativo!==false?'Ativo':'Inativo'}</span></div>
        <div class="barb-ed-detalhe">${b.especialidade||''} · ${b.horarioInicio}–${b.horarioFim} · ${slots.length} horários · ${dias}</div>
        <div class="barb-ed-detalhe" style="margin-top:0.15rem;color:var(--gray2)">${b.takenSlots?.length||0} ocupados</div>
      </div>
      <div class="barb-ed-acoes">
        <button class="svc-ed-btn" onclick="abrirModalBarbeiro('${b.id}')">✏ Editar</button>
        <button class="svc-ed-btn" onclick="toggleAtivoBarbeiro('${b.id}')">${b.ativo!==false?'⏸ Desativar':'▶ Ativar'}</button>
        <button class="svc-ed-btn" onclick="excluirBarbeiro('${b.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

export function abrirModalBarbeiro(id) {
  const barb = id ? (adminSettings.barbeiros||[]).find(b=>b.id===id) : null;
  document.getElementById('tituloModalBarbeiro').textContent = barb ? '✏ Editar Barbeiro' : '+ Novo Barbeiro';
  document.getElementById('barbIdEditando').value = id || '';
  document.getElementById('barbNome').value = barb?.nome || '';
  document.getElementById('barbEsp').value  = barb?.especialidade || '';
  document.getElementById('barbFotoUrl').value = barb?.foto || '';
  document.getElementById('barbHorarioInicio').value = barb?.horarioInicio || '08:00';
  document.getElementById('barbHorarioFim').value    = barb?.horarioFim || '18:00';
  document.getElementById('barbIntervalo').value     = String(barb?.intervalo || 60);
  document.getElementById('barbAtivo').value = String(barb?.ativo !== false);
  // Acesso ao painel
  const barbEmailEl = document.getElementById('barbEmail');
  const barbSenhaEl = document.getElementById('barbSenha');
  if (barbEmailEl) barbEmailEl.value = barb?.email || '';
  if (barbSenhaEl) barbSenhaEl.value = barb?.senha || '';
  // Bio
  const bioEl = document.getElementById('barbBio');
  if (bioEl) bioEl.value = barb?.bio || '';
  _barbEmojiSelecionado = barb?.emoji || '💈';
  const diasAtivos = barb?.diasAtendimento || [1,2,3,4,5,6];
  document.querySelectorAll('#barbDiasGrid .barb-dia-btn').forEach(btn => {
    btn.classList.toggle('on', diasAtivos.includes(parseInt(btn.dataset.dia)));
  });
  atualizarPreviewFoto(barb?.foto || '');
  document.getElementById('erroBarbeiro')?.classList.remove('show');
  // Portfólio
  renderPortfolioAdmin(id);
  document.getElementById('overlayModalBarbeiro').classList.add('show');
}
export function fecharModalBarbeiro() { document.getElementById('overlayModalBarbeiro').classList.remove('show'); }
export async function onBarbFotoChange(input) {
  const file = input?.files?.[0];
  if (!file) return;
  input.value = '';

  // Mostra loading
  const placeholder = document.getElementById('barbFotoPlaceholder');
  const loading     = document.getElementById('barbFotoLoading');
  const preview     = document.getElementById('barb-foto-preview');
  const acoes       = document.getElementById('barbFotoAcoes');
  if (placeholder) placeholder.style.display = 'none';
  if (loading)     loading.style.display      = 'flex';
  if (preview)     preview.style.display      = 'none';

  try {
    // Redimensiona para max 400px (foto de perfil)
    const base64 = await new Promise(resolve => {
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
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });

    // Tenta upload para Firebase Storage com timeout de 15s
    const fb     = window._fb;
    const barbId = document.getElementById('barbIdEditando')?.value || ('barb_' + Date.now());
    let url = base64; // fallback base64
    let uploadOk = false;

    if (fb?.storage) {
      try {
        const path   = `barbeiros/${barbId}/foto.jpg`;
        const blob   = await (await fetch(base64)).blob();
        const ref    = fb.storageRef(fb.storage, path);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 15000)
        );
        await Promise.race([fb.uploadBytes(ref, blob, { contentType: 'image/jpeg' }), timeoutPromise]);
        url      = await fb.getDownloadURL(ref);
        uploadOk = true;
      } catch (storageErr) {
        console.warn('Firebase Storage falhou, usando base64:', storageErr.code || storageErr.message);
      }
    }

    if (!uploadOk) {
      console.info('Foto salva como base64 no Firestore.');
    }

    const urlInput = document.getElementById('barbFotoUrl');
    if (urlInput) urlInput.value = url;

    // Mostra preview
    if (loading)     loading.style.display  = 'none';
    if (preview)   { preview.src = url; preview.style.display = 'block'; }
    if (acoes)       acoes.style.display    = 'flex';
    showToast('✅ Foto enviada com sucesso!');
  } catch (err) {
    if (loading)     loading.style.display     = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    showToast('❌ Erro ao enviar foto: ' + err.message);
  }
}

export function removerFotoBarbeiro() {
  const urlInput   = document.getElementById('barbFotoUrl');
  const preview    = document.getElementById('barb-foto-preview');
  const placeholder = document.getElementById('barbFotoPlaceholder');
  const acoes      = document.getElementById('barbFotoAcoes');
  if (urlInput)    urlInput.value         = '';
  if (preview)   { preview.src = ''; preview.style.display = 'none'; }
  if (placeholder) placeholder.style.display = 'flex';
  if (acoes)       acoes.style.display    = 'none';
  // Volta o emoji selecionado no preview circular (emojis abaixo)
  const prev = document.getElementById('barb-foto-preview');
  if (prev) prev.textContent = _barbEmojiSelecionado;
}

export function atualizarPreviewFoto(url) {
  const preview     = document.getElementById('barb-foto-preview');
  const placeholder = document.getElementById('barbFotoPlaceholder');
  const acoes       = document.getElementById('barbFotoAcoes');
  if (!preview) return;
  if (url) {
    preview.src          = url;
    preview.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    if (acoes)       acoes.style.display        = 'flex';
  } else {
    preview.src          = '';
    preview.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (acoes)       acoes.style.display        = 'none';
  }
}
export function selecionarEmoji(btn, emoji) {
  _barbEmojiSelecionado = emoji;
  if (!document.getElementById('barbFotoUrl')?.value) {
    const prev = document.getElementById('barb-foto-preview');
    if (prev) prev.textContent = emoji;
  }
}
export function toggleDiaBarb(btn) { btn.classList.toggle('on'); }
export async function confirmarSalvarBarbeiro() {
  const nome = document.getElementById('barbNome')?.value.trim();
  if (!nome) { document.getElementById('erroBarbeiro').classList.add('show'); return; }
  document.getElementById('erroBarbeiro').classList.remove('show');
  const id = document.getElementById('barbIdEditando').value || 'barb_' + Date.now();
  const existente = (adminSettings.barbeiros||[]).find(b=>b.id===id);
  const barbeiro = {
    id, nome,
    foto:            document.getElementById('barbFotoUrl')?.value.trim() || '',
    emoji:           _barbEmojiSelecionado,
    especialidade:   document.getElementById('barbEsp')?.value.trim() || '',
    bio:             document.getElementById('barbBio')?.value.trim() || '',
    portfolio:       existente?.portfolio || [],
    limitePortfolio: existente?.limitePortfolio || 20,
    totalCortes:     existente?.totalCortes || 0,
    avaliacoes:      existente?.avaliacoes || [],
    diasAtendimento: [...document.querySelectorAll('#barbDiasGrid .barb-dia-btn.on')].map(b => parseInt(b.dataset.dia)),
    horarioInicio:   document.getElementById('barbHorarioInicio')?.value || '08:00',
    horarioFim:      document.getElementById('barbHorarioFim')?.value || '18:00',
    intervalo:       parseInt(document.getElementById('barbIntervalo')?.value || '60'),
    ativo:           document.getElementById('barbAtivo')?.value === 'true',
    takenSlots:      existente?.takenSlots || [],
    email:           document.getElementById('barbEmail')?.value.trim() || existente?.email || '',
    senha:           document.getElementById('barbSenha')?.value.trim() || existente?.senha || '',
  };
  if (!adminSettings.barbeiros) adminSettings.barbeiros = [];
  const idx = adminSettings.barbeiros.findIndex(b => b.id === id);
  if (idx >= 0) adminSettings.barbeiros[idx] = barbeiro; else adminSettings.barbeiros.push(barbeiro);
  fecharModalBarbeiro(); renderBarbeirosAdmin();
  import('./agendamento.js').then(m => m.renderBarbeiroGrid());
  await saveAdminSettings();
}
export function toggleAtivoBarbeiro(id) {
  const b = (adminSettings.barbeiros||[]).find(x=>x.id===id); if (!b) return;
  b.ativo = !b.ativo; renderBarbeirosAdmin(); showToast(b.ativo ? '▶ Ativado!' : '⏸ Desativado!');
}
export function excluirBarbeiro(id) {
  const b = (adminSettings.barbeiros||[]).find(x=>x.id===id);
  if (!b || !confirm('Excluir "' + b.nome + '"?')) return;
  adminSettings.barbeiros = adminSettings.barbeiros.filter(x=>x.id!==id);
  renderBarbeirosAdmin(); showToast('🗑 Barbeiro excluído.');
}

/* ── Atendimentos do dia ── */
function renderAtendBarbeiros() {
  const grid = document.getElementById('atendBarbeirosGrid');
  if (!grid) return;
  const ativos = (adminSettings.barbeiros || []).filter(b => b.ativo !== false);
  grid.innerHTML = '';
  if (!ativos.length) {
    grid.innerHTML = '<div style="color:var(--gray);font-size:0.85rem;padding:1rem">Nenhum barbeiro ativo cadastrado.</div>';
    return;
  }
  ativos.forEach(b => {
    const card = document.createElement('div');
    card.className = 'atend-barb-card' + (atendBarbeiroId === b.id ? ' selecionado' : '');
    const fotoHtml = b.foto
      ? `<img src="${b.foto}" alt="${b.nome}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.textContent='${b.emoji||'💈'}'">` 
      : (b.emoji || '💈');
    card.innerHTML = `<div class="atend-barb-emoji">${fotoHtml}</div><div class="atend-barb-nome">${b.nome}</div>`;
    card.onclick = () => selecionarBarbeiro(b.id, b.nome);
    grid.appendChild(card);
  });
}

function selecionarBarbeiro(id, nome) {
  atendBarbeiroId   = id;
  atendBarbeiroNome = nome;
  atendData         = '';
  document.getElementById('atendBarbeiroStep').style.display = 'none';
  document.getElementById('atendCalStep').style.display      = 'block';
  const label = document.getElementById('atendBarbeiroNomeLabel');
  if (label) label.textContent = '💈 ' + nome;
  document.getElementById('atendDataTitulo').textContent = '← Selecione uma data no calendário';
  document.getElementById('atendLista').innerHTML = '';
  // Ativa passo 2
  document.getElementById('atendPill1')?.classList.add('done');
  document.getElementById('atendPill2')?.classList.remove('inactive');
  document.getElementById('atendPill3')?.classList.add('inactive');
  renderAtendCal();
}

export function trocarBarbeiro() {
  atendBarbeiroId   = null;
  atendBarbeiroNome = '';
  atendData         = '';
  document.getElementById('atendCalStep').style.display      = 'none';
  document.getElementById('atendBarbeiroStep').style.display = 'block';
  // Reseta pills
  document.getElementById('atendPill1')?.classList.remove('done');
  document.getElementById('atendPill2')?.classList.add('inactive');
  document.getElementById('atendPill3')?.classList.add('inactive');
  renderAtendBarbeiros();
}

function renderAtendCal() {
  const labelEl = document.getElementById('atendCalLabel');
  if (labelEl) labelEl.textContent = MONTHS_PT[atendMes] + ' ' + atendAno;
  const grid = document.getElementById('atendCalGrid');
  if (!grid) return;
  grid.innerHTML = '';
  DAYS_SHORT_PT.forEach(d => { const el = document.createElement('div'); el.className = 'cal-day-label'; el.textContent = d; grid.appendChild(el); });
  const firstDay    = new Date(atendAno, atendMes, 1).getDay();
  const daysInMonth = new Date(atendAno, atendMes+1, 0).getDate();
  for (let i = 0; i < firstDay; i++) { const el = document.createElement('div'); el.className = 'cal-day empty'; grid.appendChild(el); }
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    const ds = d.toString().padStart(2,'0') + '/' + (atendMes+1).toString().padStart(2,'0') + '/' + atendAno;
    const ehHoje = new Date(atendAno,atendMes,d).toDateString() === new Date().toDateString();
    el.className = 'cal-day' + (ehHoje ? ' today' : '');
    el.textContent = d; el.style.cursor = 'pointer';
    if (atendData === ds) el.classList.add('selected');
    el.onclick = () => {
      document.querySelectorAll('#atendCalGrid .cal-day').forEach(d=>d.classList.remove('selected'));
      el.classList.add('selected');
      atendData = ds;
      // Ativa passo 3
      document.getElementById('atendPill2')?.classList.add('done');
      document.getElementById('atendPill3')?.classList.remove('inactive');
      carregarAtendimentosDoDia(ds);
    };
    grid.appendChild(el);
  }
}
export function prevMonthAtend() { atendMes--; if(atendMes<0){atendMes=11;atendAno--;} renderAtendCal(); }
export function nextMonthAtend() { atendMes++; if(atendMes>11){atendMes=0;atendAno++;} renderAtendCal(); }

async function carregarAtendimentosDoDia(data) {
  document.getElementById('atendDataTitulo').textContent = 'Atendimentos — ' + data;
  const lista = document.getElementById('atendLista');
  lista.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--gray)">Carregando...</div>';
  const todos = await buscarAgendamentosDoDia(data);
  const agendamentos = atendBarbeiroId
    ? todos.filter(a => a.barbeiroId === atendBarbeiroId)
    : todos;
  lista.innerHTML = '';
  if (!agendamentos.length && atendBarbeiroId) {
    lista.innerHTML = `<div class="atend-sem-data">Nenhum atendimento para ${atendBarbeiroNome} neste dia.</div>`;
    return;
  }
  const dur = adminSettings.duracaoPadrao || 60;
  const durLabel = dur >= 60 ? (dur===60?'1h':(dur/60).toFixed(1).replace('.0','')+'h') : dur+'min';

  /* Barbeiro ativo: usar os slots do próprio barbeiro se disponível */
  let slots = adminSettings.slots || [];
  if (atendBarbeiroId) {
    const barb = (adminSettings.barbeiros||[]).find(b => b.id === atendBarbeiroId);
    if (barb && barb.slots && barb.slots.length) slots = barb.slots;
  }

  [...slots].sort().forEach(horario => {
    const bloqueado = adminSettings.takenSlots.includes(horario);
    const reserva   = agendamentos.find(a => a.horario === horario);
    const card = document.createElement('div');
    const base = `<div><div class="atend-hora">${horario}</div><div class="atend-duracao">⏱ ${durLabel}</div>`;
    if (bloqueado) {
      card.className = 'card-atendimento bloqueado';
      card.innerHTML = base + '<span class="atend-badge bloqueado">🔴 Bloqueado</span></div><div class="atend-info"><div class="atend-livre-msg">Horário bloqueado</div></div>';
    } else if (reserva) {
      const svcs = (reserva.servicos||'').split(', ').map(s=>`<span class="service-tag">${s}</span>`).join('');
      const jaRealizado = reserva.realizado === true;
      card.className = 'card-atendimento ' + (jaRealizado ? 'realizado' : 'reservado');
      const btnReal = jaRealizado
        ? '<button class="atend-btn-realizado done" disabled>✓ Realizado</button>'
        : `<button class="atend-btn-realizado" onclick="marcarAtendimentoRealizado('${reserva.id || ''}','${atendBarbeiroId}',this)">✓ Concluir</button>`;
      card.innerHTML = base + '<span class="atend-badge ' + (jaRealizado ? 'realizado' : 'reservado') + '">' + (jaRealizado ? '✅ Realizado' : '🟠 Reservado') + '</span></div><div class="atend-info"><div class="atend-cliente-nome">👤 '+(reserva.cliente||'—')+'</div><div class="atend-cliente-tel">📱 '+(reserva.telefone||reserva.whatsapp||'—')+'</div><div class="atend-servicos">'+svcs+'</div><div class="atend-total">R$ '+(reserva.total||'—')+'</div>' + btnReal + '</div>';
    } else {
      card.className = 'card-atendimento livre';
      card.innerHTML = base + '<span class="atend-badge livre">🟢 Livre</span></div><div class="atend-info"><div class="atend-livre-msg">Disponível</div></div>';
    }
    lista.appendChild(card);
  });

  // Mostra botão de impressão agora que a lista foi carregada
  const imprimirWrap = document.getElementById('atendImprimirWrap');
  if (imprimirWrap) imprimirWrap.style.display = agendamentos.length ? 'block' : 'none';
}

/* ── Imprime agenda do dia em PDF ── */
/* ══════════════════════════════════════════
   IMPRESSÃO DA AGENDA DO DIA (PDF)
══════════════════════════════════════════ */

export async function imprimirAgendaDoDia() {
  if (!atendData) { showToast('⚠ Selecione uma data primeiro.'); return; }

  showToast('⏳ Gerando PDF...');

  const todos = await buscarAgendamentosDoDia(atendData);
  const agendamentos = atendBarbeiroId
    ? todos.filter(a => a.barbeiroId === atendBarbeiroId)
    : todos;

  let slots = adminSettings.slots || [];
  if (atendBarbeiroId) {
    const barb = (adminSettings.barbeiros || []).find(b => b.id === atendBarbeiroId);
    if (barb?.slots?.length) slots = barb.slots;
  }
  slots = [...slots].sort();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, pad = 15;

  // ── Fundo e cabeçalho ──
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, W, 297, 'F');

  doc.setFillColor(224, 32, 32);
  doc.rect(0, 0, W, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('BARBEARIA DO DAVI', pad, 14);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 200, 200);
  doc.text('Vila Guará · Luziânia – GO  |  @davi_barber10', pad, 21);

  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('AGENDA DO DIA — ' + atendData, pad, 30);

  if (atendBarbeiroNome) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 230, 230);
    doc.text('Barbeiro: ' + atendBarbeiroNome, W - pad, 30, { align: 'right' });
  }

  // ── Totais rápidos ──
  const reservados = agendamentos.filter(a => a.status !== 'cancelado');
  const realizados = agendamentos.filter(a => a.realizado === true);
  const totalFaturado = agendamentos.reduce((s, a) => s + parseFloat(a.total || 0), 0);
  const dur = adminSettings.duracaoPadrao || 60;
  const durLabel = dur >= 60 ? (dur === 60 ? '1h' : (dur / 60).toFixed(1).replace('.0', '') + 'h') : dur + 'min';

  let y = 44;
  const statsData = [
    ['📅 Total de slots', slots.length],
    ['🟠 Reservados', reservados.length],
    ['✅ Realizados', realizados.length],
    ['🟢 Livres', slots.length - reservados.length],
    ['💰 Faturado', 'R$ ' + totalFaturado.toFixed(2).replace('.', ',')],
  ];
  const colW = (W - pad * 2) / statsData.length;
  statsData.forEach(([label, val], i) => {
    const x = pad + i * colW;
    doc.setFillColor(26, 26, 26);
    doc.roundedRect(x, y, colW - 2, 16, 1, 1, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(String(val), x + (colW - 2) / 2, y + 7, { align: 'center' });
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(label, x + (colW - 2) / 2, y + 13, { align: 'center' });
  });

  y += 22;

  // ── Cabeçalho da tabela ──
  doc.setFillColor(40, 40, 40);
  doc.rect(pad, y, W - pad * 2, 8, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 200, 200);
  doc.text('HORÁRIO', pad + 3, y + 5.5);
  doc.text('STATUS', pad + 22, y + 5.5);
  doc.text('CLIENTE', pad + 50, y + 5.5);
  doc.text('SERVIÇOS', pad + 90, y + 5.5);
  doc.text('TOTAL', W - pad - 3, y + 5.5, { align: 'right' });
  y += 10;

  // ── Linhas da tabela ──
  slots.forEach((horario, idx) => {
    if (y > 275) {
      doc.addPage();
      doc.setFillColor(10, 10, 10);
      doc.rect(0, 0, 210, 297, 'F');
      y = 15;
    }

    const reserva = agendamentos.find(a => a.horario === horario && a.status !== 'cancelado');
    const bloqueado = adminSettings.takenSlots.includes(horario) && !reserva;
    const rowH = 10;

    // Cor de fundo alternada
    const bg = idx % 2 === 0 ? [22, 22, 22] : [28, 28, 28];
    doc.setFillColor(...bg);
    doc.rect(pad, y, W - pad * 2, rowH, 'F');

    // Borda de status à esquerda
    if (reserva?.realizado) {
      doc.setFillColor(34, 139, 34);
    } else if (reserva) {
      doc.setFillColor(224, 140, 32);
    } else if (bloqueado) {
      doc.setFillColor(180, 32, 32);
    } else {
      doc.setFillColor(50, 168, 82);
    }
    doc.rect(pad, y, 2, rowH, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(horario, pad + 4, y + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    if (reserva?.realizado) {
      doc.setTextColor(34, 200, 34);
      doc.text('✓ Realizado', pad + 22, y + 6.5);
    } else if (reserva) {
      doc.setTextColor(255, 180, 50);
      doc.text('Reservado', pad + 22, y + 6.5);
    } else if (bloqueado) {
      doc.setTextColor(255, 80, 80);
      doc.text('Bloqueado', pad + 22, y + 6.5);
    } else {
      doc.setTextColor(80, 200, 80);
      doc.text('Livre', pad + 22, y + 6.5);
    }

    if (reserva) {
      doc.setTextColor(230, 230, 230);
      const nomeClip = (reserva.cliente || '—').slice(0, 20);
      doc.text(nomeClip, pad + 50, y + 6.5);

      const svcsClip = (reserva.servicos || '—').replace(/[^\x00-\x7F]/g, '').trim().slice(0, 35);
      doc.setTextColor(180, 180, 180);
      doc.text(svcsClip, pad + 90, y + 6.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(224, 32, 32);
      doc.text('R$ ' + (reserva.total || '0'), W - pad - 3, y + 6.5, { align: 'right' });
    }

    y += rowH + 1;
  });

  // ── Rodapé ──
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(
    'Gerado em ' + new Date().toLocaleString('pt-BR') + '  ·  Barbearia do Davi',
    W / 2, 292, { align: 'center' }
  );

  const nomeArq = 'agenda-' + atendData.replace(/\//g, '-') + (atendBarbeiroNome ? '-' + atendBarbeiroNome.toLowerCase().replace(/\s+/g, '_') : '') + '.pdf';
  doc.save(nomeArq);
  showToast('📄 PDF gerado: ' + nomeArq);
}

/* ══════════════════════════════════════════
   EXPORTAR AGENDA COMO IMAGEM (PNG)
   Gera via Canvas — ideal para WhatsApp
══════════════════════════════════════════ */
export async function exportarAgendaImagem() {
  if (!atendData) { showToast('⚠ Selecione uma data primeiro.'); return; }

  showToast('⏳ Gerando imagem...');

  const todos = await buscarAgendamentosDoDia(atendData);
  const agendamentos = atendBarbeiroId
    ? todos.filter(a => a.barbeiroId === atendBarbeiroId)
    : todos;

  let slots = adminSettings.slots || [];
  if (atendBarbeiroId) {
    const barb = (adminSettings.barbeiros || []).find(b => b.id === atendBarbeiroId);
    if (barb?.slots?.length) slots = barb.slots;
  }
  slots = [...slots].sort();

  // ── Dimensões ──
  const W = 800, PAD = 32;
  const ROW_H = 52;
  const HEADER_H = 110;
  const STATS_H = 80;
  const FOOTER_H = 44;
  const H = HEADER_H + STATS_H + (slots.length * (ROW_H + 4)) + FOOTER_H + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ── Fundo ──
  ctx.fillStyle = '#0A0A0A';
  ctx.fillRect(0, 0, W, H);

  // ── Faixa vermelha header ──
  ctx.fillStyle = '#E02020';
  ctx.fillRect(0, 0, W, HEADER_H - 14);

  // ── Título ──
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('BARBEARIA DO DAVI', PAD, 40);

  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,200,200,0.9)';
  ctx.fillText('Vila Guará · Luziânia – GO  |  @davi_barber10', PAD, 62);

  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('AGENDA DO DIA — ' + atendData, PAD, 86);

  if (atendBarbeiroNome) {
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,230,230,0.85)';
    ctx.textAlign = 'right';
    ctx.fillText('Barbeiro: ' + atendBarbeiroNome, W - PAD, 86);
    ctx.textAlign = 'left';
  }

  // ── Stats ──
  const reservados   = agendamentos.filter(a => a.status !== 'cancelado');
  const realizados   = agendamentos.filter(a => a.realizado === true);
  const totalFatur   = agendamentos.reduce((s, a) => s + parseFloat(a.total || 0), 0);
  const livres       = slots.length - reservados.length;

  const stats = [
    { icon: '📅', val: slots.length,               label: 'Total slots' },
    { icon: '🟠', val: reservados.length,           label: 'Reservados'  },
    { icon: '✅', val: realizados.length,           label: 'Realizados'  },
    { icon: '🟢', val: livres,                      label: 'Livres'      },
    { icon: '💰', val: 'R$ ' + totalFatur.toFixed(2).replace('.', ','), label: 'Faturado' },
  ];
  const colW = (W - PAD * 2) / stats.length;
  const sy   = HEADER_H - 10;
  stats.forEach(({ icon, val, label }, i) => {
    const x = PAD + i * colW;
    ctx.fillStyle = '#1A1A1A';
    roundRect(ctx, x, sy, colW - 6, 64, 6);
    ctx.fill();

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(icon + ' ' + val, x + (colW - 6) / 2, sy + 26);

    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#777';
    ctx.fillText(label, x + (colW - 6) / 2, sy + 46);
    ctx.textAlign = 'left';
  });

  // ── Cabeçalho tabela ──
  let y = sy + 72;
  ctx.fillStyle = '#282828';
  ctx.fillRect(PAD, y, W - PAD * 2, 32);
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#AAAAAA';
  const cols = [
    { label: 'HORÁRIO',  x: PAD + 12 },
    { label: 'STATUS',   x: PAD + 80 },
    { label: 'CLIENTE',  x: PAD + 200 },
    { label: 'SERVIÇOS', x: PAD + 380 },
    { label: 'TOTAL',    x: W - PAD - 12, align: 'right' },
  ];
  cols.forEach(c => {
    ctx.textAlign = c.align || 'left';
    ctx.fillText(c.label, c.x, y + 21);
  });
  ctx.textAlign = 'left';
  y += 36;

  // ── Linhas ──
  slots.forEach((horario, idx) => {
    const reserva   = agendamentos.find(a => a.horario === horario && a.status !== 'cancelado');
    const bloqueado = (adminSettings.takenSlots || []).includes(horario) && !reserva;

    ctx.fillStyle = idx % 2 === 0 ? '#161616' : '#1C1C1C';
    ctx.fillRect(PAD, y, W - PAD * 2, ROW_H);

    // Barra lateral de status
    if (reserva?.realizado)  ctx.fillStyle = '#228B22';
    else if (reserva)         ctx.fillStyle = '#E08C20';
    else if (bloqueado)       ctx.fillStyle = '#B42020';
    else                      ctx.fillStyle = '#32A852';
    ctx.fillRect(PAD, y, 4, ROW_H);

    // Horário
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(horario, PAD + 12, y + ROW_H / 2 + 5);

    // Status
    ctx.font = '12px sans-serif';
    if (reserva?.realizado)  { ctx.fillStyle = '#22C822'; ctx.fillText('✓ Realizado', PAD + 80, y + ROW_H / 2 + 5); }
    else if (reserva)         { ctx.fillStyle = '#FFB432'; ctx.fillText('Reservado',   PAD + 80, y + ROW_H / 2 + 5); }
    else if (bloqueado)       { ctx.fillStyle = '#FF5050'; ctx.fillText('Bloqueado',   PAD + 80, y + ROW_H / 2 + 5); }
    else                      { ctx.fillStyle = '#50C850'; ctx.fillText('Livre',       PAD + 80, y + ROW_H / 2 + 5); }

    if (reserva) {
      ctx.fillStyle = '#E0E0E0';
      ctx.font = '13px sans-serif';
      ctx.fillText((reserva.cliente || '—').slice(0, 18), PAD + 200, y + ROW_H / 2 + 5);

      ctx.fillStyle = '#AAAAAA';
      ctx.fillText((reserva.servicos || '—').replace(/[^\x00-\x7F]/g, '').trim().slice(0, 24), PAD + 380, y + ROW_H / 2 + 5);

      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#E02020';
      ctx.textAlign = 'right';
      ctx.fillText('R$ ' + (reserva.total || '0'), W - PAD - 12, y + ROW_H / 2 + 5);
      ctx.textAlign = 'left';
    }

    y += ROW_H + 4;
  });

  // ── Rodapé ──
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#555';
  ctx.textAlign = 'center';
  ctx.fillText(
    'Gerado em ' + new Date().toLocaleString('pt-BR') + '  ·  Barbearia do Davi',
    W / 2, y + 28
  );
  ctx.textAlign = 'left';

  // ── Download ──
  const link = document.createElement('a');
  link.download = 'agenda-' + atendData.replace(/\//g, '-') + (atendBarbeiroNome ? '-' + atendBarbeiroNome.toLowerCase().replace(/\s+/g, '_') : '') + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();

  showToast('🖼️ Imagem salva!');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ══════════════════════════════════════════
   INSTAGRAM STORIES
══════════════════════════════════════════ */

/* Inicializa a aba com data de hoje e lista de barbeiros */
function renderInstagramTab() {
  const dataInput = document.getElementById('instaData');
  if (dataInput && !dataInput.value) {
    const hoje = new Date();
    dataInput.value = hoje.toISOString().split('T')[0];
  }
  const sel = document.getElementById('instaBarbeiro');
  if (sel) {
    sel.innerHTML = '<option value="todos">Todos os barbeiros</option>';
    (adminSettings.barbeiros || []).filter(b => b.ativo !== false).forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id; opt.textContent = b.nome;
      sel.appendChild(opt);
    });
  }
  // Mostrar botão compartilhar apenas se suportado
  const btnComp = document.getElementById('btnCompartilhar');
  if (btnComp) btnComp.style.display = !!navigator.share ? 'block' : 'none';
}

/* Retorna os slots livres para um barbeiro numa data (async, consulta Firestore) */
async function obterSlotsDoBarbeiro(barbeiroId, dataStr) {
  let slots = [];
  if (barbeiroId === 'todos') {
    slots = [...(adminSettings.slots || [])];
  } else {
    const barb = (adminSettings.barbeiros || []).find(b => b.id === barbeiroId);
    slots = barb && barb.slots && barb.slots.length ? [...barb.slots] : [...(adminSettings.slots || [])];
  }
  // Buscar agendamentos do dia para filtrar ocupados
  let ocupados = [];
  try {
    const ags = await buscarAgendamentosDoDia(dataStr);
    ocupados = ags
      .filter(a => barbeiroId === 'todos' || a.barbeiroId === barbeiroId)
      .map(a => a.horario);
  } catch (_) {}
  const bloqueados = adminSettings.takenSlots || [];
  return slots.filter(s => !ocupados.includes(s) && !bloqueados.includes(s)).sort();
}

/* Converte "2025-04-11" → "11 de abril de 2025" */
function formatarDataPtBR(iso) {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${meses[m-1]} de ${y}`;
}

/* Função principal — gera o canvas */
export async function gerarStory() {
  const dataVal    = document.getElementById('instaData')?.value;
  const barbeiroId = document.getElementById('instaBarbeiro')?.value || 'todos';
  const promoTxt   = (document.getElementById('instaPromo')?.value || '').trim();

  if (!dataVal) { showToast('⚠ Selecione uma data'); return; }

  showToast('⏳ Gerando Story...');

  // Coletar dados
  let dadosBarbeiros = [];
  if (barbeiroId === 'todos') {
    const ativos = (adminSettings.barbeiros || []).filter(b => b.ativo !== false);
    for (const b of ativos) {
      const livres = await obterSlotsDoBarbeiro(b.id, formatarDataFirestore(dataVal));
      dadosBarbeiros.push({ nome: b.nome, emoji: b.emoji || b.foto || '💈', livres });
    }
  } else {
    const barb = (adminSettings.barbeiros || []).find(b => b.id === barbeiroId);
    const livres = await obterSlotsDoBarbeiro(barbeiroId, formatarDataFirestore(dataVal));
    dadosBarbeiros.push({ nome: barb?.nome || 'Barbeiro', emoji: barb?.emoji || barb?.foto || '💈', livres });
  }

  desenharStoryCanvas({ dataVal, dadosBarbeiros, promoTxt });

  // Mostrar ações
  const acoes = document.getElementById('instaAcoes');
  if (acoes) { acoes.style.display = 'flex'; }
  document.getElementById('instaPlaceholder')?.style && (document.getElementById('instaPlaceholder').style.display = 'none');
  showToast('✅ Story gerado!');
}

/* Converte ISO "2025-04-11" para formato Firestore "11/04/2025" */
function formatarDataFirestore(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/* Calcula a altura necessária do canvas baseada no conteúdo */
function calcularAlturaCanvas(dadosBarbeiros, promoTxt) {
  const slotCols = 3, slotH = 88, slotGapY = 20;
  const HEADER = 720;   // logo + título + data + separador
  const FOOTER = 320;   // separador + nome barbearia + link + barra vermelha
  const PROMO  = promoTxt ? 180 : 0;
  let contentH = 0;
  for (const barb of dadosBarbeiros) {
    contentH += 80; // nome do barbeiro
    if (!barb.livres.length) {
      contentH += 90;
    } else {
      const rows = Math.ceil(barb.livres.length / slotCols);
      contentH += rows * (slotH + slotGapY) + 40;
    }
    contentH += 90; // espaço / separador entre barbeiros
  }
  return Math.max(HEADER + contentH + PROMO + FOOTER, 1920);
}

/* Desenha tudo no canvas com altura dinâmica */
function desenharStoryCanvas({ dataVal, dadosBarbeiros, promoTxt }) {
  const canvas = document.getElementById('instaCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 1080;
  const H = calcularAlturaCanvas(dadosBarbeiros, promoTxt);
  canvas.width = W; canvas.height = H;

  // ── Fundo ───────────────────────────────────────────────
  ctx.fillStyle = '#0D0D0D';
  ctx.fillRect(0, 0, W, H);

  // Textura pontilhada sutil
  ctx.fillStyle = 'rgba(255,255,255,0.018)';
  for (let x = 0; x < W; x += 40) for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI*2); ctx.fill();
  }

  // Barras vermelhas (topo, base, lateral)
  ctx.fillStyle = '#E02020';
  ctx.fillRect(0, 0, W, 14);
  ctx.fillRect(0, H - 14, W, 14);
  ctx.fillStyle = 'rgba(224,32,32,0.12)';
  ctx.fillRect(0, 14, 6, H - 28);

  // ── Logo ────────────────────────────────────────────────
  let curY = 60;
  ctx.font = 'bold 110px "Arial Black", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  curY += 110;
  ctx.fillText('BARBEARIA', W/2, curY);

  ctx.font = 'bold 180px "Arial Black", Arial, sans-serif';
  ctx.fillStyle = '#E02020';
  curY += 190;
  ctx.fillText('DAVI', W/2, curY);

  // Linha separadora vermelha
  curY += 50;
  ctx.strokeStyle = '#E02020'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(80, curY); ctx.lineTo(W - 80, curY); ctx.stroke();

  // ── Título + Data ────────────────────────────────────────
  curY += 90;
  ctx.font = 'bold 68px "Arial Black", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText('HORÁRIOS DISPONÍVEIS', W/2, curY);

  curY += 65;
  ctx.font = '400 44px Arial, sans-serif';
  ctx.fillStyle = '#888888';
  ctx.fillText(formatarDataPtBR(dataVal).toUpperCase(), W/2, curY);

  // Linha separadora fina
  curY += 50;
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, curY); ctx.lineTo(W - 80, curY); ctx.stroke();
  curY += 60;

  // ── Lista por barbeiro ───────────────────────────────────
  const slotCols = 3;
  const slotW = 240, slotH = 88;
  const slotGapX = 40, slotGapY = 20;
  const blockX = (W - (slotCols * slotW + (slotCols - 1) * slotGapX)) / 2;

  for (let bi = 0; bi < dadosBarbeiros.length; bi++) {
    const barb = dadosBarbeiros[bi];

    // Nome do barbeiro
    ctx.font = 'bold 50px "Arial Black", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(`${barb.emoji}  ${barb.nome.toUpperCase()}`, 80, curY);
    curY += 70;

    if (!barb.livres.length) {
      ctx.font = '400 40px Arial, sans-serif';
      ctx.fillStyle = '#555555';
      ctx.fillText('Sem horários disponíveis', 80, curY + 40);
      curY += 90;
    } else {
      const rowStartY = curY;
      barb.livres.forEach((h, i) => {
        const col = i % slotCols;
        const row = Math.floor(i / slotCols);
        const sx = blockX + col * (slotW + slotGapX);
        const sy = rowStartY + row * (slotH + slotGapY);
        ctx.fillStyle = 'rgba(224,32,32,0.15)';
        roundRect(ctx, sx, sy, slotW, slotH, 6); ctx.fill();
        ctx.strokeStyle = '#E02020'; ctx.lineWidth = 2;
        roundRect(ctx, sx, sy, slotW, slotH, 6); ctx.stroke();
        ctx.font = 'bold 48px "Arial Black", Arial, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(h, sx + slotW / 2, sy + slotH / 2 + 17);
      });
      const rows = Math.ceil(barb.livres.length / slotCols);
      curY += rows * (slotH + slotGapY) + 30;
    }

    // Separador entre barbeiros (exceto o último)
    if (bi < dadosBarbeiros.length - 1) {
      curY += 20;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(80, curY); ctx.lineTo(W - 80, curY); ctx.stroke();
      curY += 40;
    }
  }

  curY += 60;

  // ── Promoção ─────────────────────────────────────────────
  if (promoTxt) {
    ctx.fillStyle = 'rgba(224,32,32,0.2)';
    roundRect(ctx, 80, curY, W - 160, 110, 6); ctx.fill();
    ctx.strokeStyle = '#E02020'; ctx.lineWidth = 3;
    roundRect(ctx, 80, curY, W - 160, 110, 6); ctx.stroke();
    ctx.font = 'bold 50px "Arial Black", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(promoTxt.toUpperCase(), W / 2, curY + 73);
    curY += 150;
  }

  // ── Rodapé ───────────────────────────────────────────────
  curY += 20;
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, curY); ctx.lineTo(W - 80, curY); ctx.stroke();

  curY += 80;
  ctx.font = 'bold 52px "Arial Black", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText('BARBEARIA DO DAVI', W / 2, curY);

  curY += 70;
  ctx.font = '400 40px Arial, sans-serif';
  ctx.fillStyle = '#E02020';
  ctx.fillText('Agende pelo link na bio 📲', W / 2, curY);
}

/* Helper: roundRect path */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* Download da imagem */
export function baixarStory() {
  const canvas = document.getElementById('instaCanvas');
  if (!canvas) return;
  const dataVal = document.getElementById('instaData')?.value || 'hoje';
  const [y, m, d] = dataVal.split('-');
  const nome = `story-barbearia-${d || ''}${m || ''}${y || ''}.png`;
  const link = document.createElement('a');
  link.download = nome;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('⬇ Download iniciado!');
}

/* Compartilhar via Web Share API */
export async function compartilharStory() {
  const canvas = document.getElementById('instaCanvas');
  if (!canvas || !navigator.share) return;
  canvas.toBlob(async (blob) => {
    const dataVal = document.getElementById('instaData')?.value || 'hoje';
    const file = new File([blob], `story-barbearia-${dataVal}.png`, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: 'Story Barbearia do Davi' });
    } catch (e) {
      if (e.name !== 'AbortError') showToast('⚠ Compartilhamento não suportado neste dispositivo.');
    }
  }, 'image/png');
}


export function exportarAtendimentosPDF() {
  if (!atendData) { showToast('⚠ Selecione uma data primeiro!'); return; }
  showToast('📄 Função de PDF disponível — instale jsPDF para usar.');
}

/* ── Backup ── */
function gerarDadosBackup() {
  return { versao:'1.0', app:'Barbearia do Davi', geradoEm:new Date().toISOString(), geradoEmFormatado:new Date().toLocaleString('pt-BR'),
    configuracoes:{ barbeariaAberta:adminSettings.shopOpen, diasTrabalho:adminSettings.workDays, horariosTrabalho:adminSettings.workHours, horarios:adminSettings.slots, horariosOcupados:adminSettings.takenSlots, datasBloqueadas:adminSettings.blockedDates, duracaoPadrao:adminSettings.duracaoPadrao, servicos:adminSettings.services } };
}
export function fazerBackupJSON() {
  const dados = gerarDadosBackup();
  const blob  = new Blob([JSON.stringify(dados, null, 2)], { type:'application/json;charset=utf-8' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a'); a.href = url; a.download = 'backup-barbearia-davi-'+new Date().toISOString().split('T')[0]+'.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  salvarBackupFirestore(dados); showToast('✅ Backup JSON baixado!');
}
async function salvarBackupFirestore(dados) {
  if (!window._fb) return;
  try { await window._fb.setDoc(window._fb.doc(window._fb.db,'backups','backup_'+Date.now()), {...dados}); } catch (e) { /* ignora */ }
}
export async function carregarHistoricoBackup() {
  const lista = document.getElementById('backupHistoricoLista');
  if (!lista) return;
  lista.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--gray)">Carregando...</div>';
  if (!window._fb) { lista.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--gray2)">Firebase não disponível.</div>'; return; }
  try {
    const q = window._fb.query(window._fb.collection(window._fb.db,'backups'), window._fb.orderBy('geradoEm','desc'));
    const snap = await window._fb.getDocs(q);
    if (snap.empty) { lista.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--gray2)">Nenhum backup ainda.</div>'; return; }
    lista.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data(); if (d.deletado) return;
      const item = document.createElement('div'); item.className = 'backup-item';
      item.innerHTML = `<div class="backup-item-info"><div class="backup-item-data">📦 ${d.geradoEmFormatado||d.geradoEm}</div><div class="backup-item-detalhe">${d.configuracoes?.servicos?.length||0} serviços · ${d.configuracoes?.horarios?.length||0} horários</div></div>
        <div class="backup-item-acoes">
          <button class="btn-restaurar-backup" onclick="restaurarBackupFirestore('${doc.id}')">↩ Restaurar</button>
          <button class="btn-del-backup" onclick="excluirBackup('${doc.id}',this)">✕</button>
        </div>`;
      lista.appendChild(item);
    });
  } catch (e) { lista.innerHTML = '<div style="text-align:center;color:var(--red)">Erro: '+e.message+'</div>'; }
}
export function importarBackupJSON() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const arquivo = e.target.files[0]; if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = ev => {
      try {
        const dados = JSON.parse(ev.target.result);
        const cfg = dados.configuracoes || dados;
        if (!cfg.servicos && !cfg.horarios) { showToast('❌ Arquivo inválido.'); return; }
        if (!confirm('Importar backup?')) return;
        if (cfg.barbeariaAberta !== undefined) adminSettings.shopOpen = cfg.barbeariaAberta;
        if (cfg.diasTrabalho    !== undefined) adminSettings.workDays = cfg.diasTrabalho;
        if (cfg.horariosTrabalho!== undefined) adminSettings.workHours= cfg.horariosTrabalho;
        if (cfg.horarios        !== undefined) adminSettings.slots    = cfg.horarios;
        if (cfg.horariosOcupados!== undefined) adminSettings.takenSlots= cfg.horariosOcupados;
        if (cfg.datasBloqueadas !== undefined) adminSettings.blockedDates= cfg.datasBloqueadas;
        if (cfg.duracaoPadrao   !== undefined) adminSettings.duracaoPadrao= cfg.duracaoPadrao;
        if (cfg.servicos        !== undefined) adminSettings.services  = cfg.servicos;
        renderAdminDash(); import('./index.js').then(m => m.renderGallery()); showToast('✅ Importado! Salve para confirmar.');
      } catch (err) { showToast('❌ Arquivo corrompido.'); }
    };
    leitor.readAsText(arquivo);
  };
  input.click();
}
export async function restaurarBackupFirestore(id) {
  if (!confirm('Restaurar este backup?') || !window._fb) return;
  try {
    const snap = await window._fb.getDoc(window._fb.doc(window._fb.db,'backups',id));
    if (!snap.exists()) { showToast('❌ Backup não encontrado.'); return; }
    const cfg = snap.data().configuracoes; if (!cfg) { showToast('❌ Inválido.'); return; }
    if (cfg.barbeariaAberta !== undefined) adminSettings.shopOpen = cfg.barbeariaAberta;
    if (cfg.servicos        !== undefined) adminSettings.services = cfg.servicos;
    renderAdminDash(); import('./index.js').then(m => m.renderGallery()); showToast('✅ Restaurado! Salve para confirmar.');
  } catch (e) { showToast('❌ Erro: ' + e.message); }
}
export async function excluirBackup(id, btn) {
  if (!confirm('Excluir este backup?') || !window._fb) return;
  try {
    await window._fb.setDoc(window._fb.doc(window._fb.db,'backups',id),{deletado:true},{merge:true});
    btn?.closest('.backup-item')?.remove(); showToast('🗑 Backup excluído.');
  } catch (e) { showToast('❌ Erro: ' + e.message); }
}

/* ── Solicitações ── */
let _solicitacoesCache = [];
let solFiltroAtual = 'todos';
export async function carregarSolicitacoes() {
  const lista = document.getElementById('listaSolicitacoes');
  if (!lista) return;
  lista.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--gray)">Carregando...</div>';
  if (!window._fb) { lista.innerHTML = '<div class="atend-sem-data">Firebase não disponível.</div>'; return; }
  try {
    const q = window._fb.query(window._fb.collection(window._fb.db,'solicitacoes'), window._fb.orderBy('criadoEm','desc'));
    const snap = await window._fb.getDocs(q);
    _solicitacoesCache = [];
    snap.forEach(doc => _solicitacoesCache.push({id:doc.id,...doc.data()}));
    if (snap.empty) { lista.innerHTML = '<div class="atend-sem-data">Nenhuma solicitação.</div>'; return; }
    renderSolicitacoesFiltradas();
  } catch (e) { lista.innerHTML = '<div class="atend-sem-data" style="color:var(--red)">Erro: '+e.message+'</div>'; }
}
export function filtrarSolicitacoes(filtro) {
  solFiltroAtual = filtro;
  ['filtroTodos','filtroPendente','filtroAprovado','filtroRecusado'].forEach(id => document.getElementById(id)?.classList.remove('ativo'));
  document.getElementById('filtro'+filtro.charAt(0).toUpperCase()+filtro.slice(1))?.classList.add('ativo');
  renderSolicitacoesFiltradas();
}
function renderSolicitacoesFiltradas() {
  const lista = document.getElementById('listaSolicitacoes');
  if (!lista) return;
  const dados = solFiltroAtual === 'todos' ? _solicitacoesCache : _solicitacoesCache.filter(s=>s.status===solFiltroAtual);
  if (!dados.length) { lista.innerHTML = '<div class="atend-sem-data">Nenhuma solicitação encontrada.</div>'; return; }
  lista.innerHTML = '';
  dados.forEach(sol => {
    const card = document.createElement('div'); card.className = 'card-solicitacao '+sol.status;
    const isRemarc = sol.tipo === 'remarcacao';
    const acoesBtns = sol.status === 'pendente' ? `<button class="btn-aprovar-sol" onclick="responderSolicitacao('${sol.id}','aprovado')">✓ Aprovar</button><button class="btn-recusar-sol" onclick="responderSolicitacao('${sol.id}','recusado')">✕ Recusar</button>` : '';
    card.innerHTML = `<div class="sol-header"><div style="display:flex;gap:0.4rem;flex-wrap:wrap"><span class="sol-badge ${isRemarc?'remarcacao':'reembolso'}">${isRemarc?'🔄 Remarcação':'💰 Reembolso'}</span><span class="sol-badge ${sol.status}">${sol.status==='pendente'?'🟠 Pendente':sol.status==='aprovado'?'✅ Aprovado':'❌ Recusado'}</span></div><div style="font-size:0.68rem;color:var(--gray)">${sol.criadoEmFormatado||''}</div></div>
    <div class="sol-info-grid"><div class="sol-info-item"><span>Cliente</span><span>${sol.cliente||'—'}</span></div><div class="sol-info-item"><span>Telefone</span><span>${sol.telefone||'—'}</span></div><div class="sol-info-item"><span>Data original</span><span>${sol.dataOriginal||'—'} às ${sol.horarioOriginal||'—'}</span></div>${isRemarc?`<div class="sol-info-item"><span>Nova data</span><span style="color:#6FCF97">${sol.novaData||'—'} às ${sol.novoHorario||'—'}</span></div>`:''}${sol.motivo?`<div class="sol-info-item" style="grid-column:1/-1"><span>Motivo</span><span>${sol.motivo}</span></div>`:''}</div>
    ${acoesBtns ? `<div class="sol-acoes">${acoesBtns}</div>` : ''}`;
    lista.appendChild(card);
  });
}
export async function responderSolicitacao(id, decisao) {
  if (!window._fb || !confirm((decisao==='aprovado'?'Aprovar':'Recusar') + ' esta solicitação?')) return;
  try {
    await window._fb.setDoc(window._fb.doc(window._fb.db,'solicitacoes',id),{status:decisao,respondidoEm:new Date().toISOString()},{merge:true});
    showToast(decisao==='aprovado'?'✅ Aprovada!':'❌ Recusada.'); await carregarSolicitacoes();
  } catch (e) { showToast('❌ Erro: '+e.message); }
}
export function carregarPoliticaReembolsoForm() {
  const pol = adminSettings.politicaReembolso || {};
  const set = (id,val) => { const el=document.getElementById(id); if(el) el.value=String(val); };
  set('politReembolsoAtivo',   String(pol.reembolsoAtivo !== false));
  set('politRemarcacaoAtiva',  String(pol.remarcacaoAtiva !== false));
  set('politPrazoReembolso',   pol.prazoReembolsoDias  ?? 1);
  set('politPrazoRemarcacao',  pol.prazoRemarcacaoDias ?? 1);
  set('politMaxRemarcacoes',   pol.maxRemarcacoes      ?? 2);
  set('politTaxaPlataforma',   pol.taxaPlataforma      ?? 0);
  set('politTipoReembolso',    pol.tipoReembolso       || 'integral');
}
export async function salvarPoliticaReembolso() {
  const get = id => document.getElementById(id)?.value;
  adminSettings.politicaReembolso = {
    reembolsoAtivo:      get('politReembolsoAtivo')  === 'true',
    remarcacaoAtiva:     get('politRemarcacaoAtiva') === 'true',
    prazoReembolsoDias:  parseInt(get('politPrazoReembolso')  || '1'),
    prazoRemarcacaoDias: parseInt(get('politPrazoRemarcacao') || '1'),
    maxRemarcacoes:      parseInt(get('politMaxRemarcacoes')   || '2'),
    taxaPlataforma:      parseFloat(get('politTaxaPlataforma') || '0'),
    tipoReembolso:       get('politTipoReembolso') || 'integral',
  };
  await saveAdminSettings(); showToast('💾 Política salva!');
}

/* ── Dashboard ── */
export async function carregarDashboard() {
  const dias = parseInt(document.getElementById('dashPeriodo')?.value || '30');
  const inicio = new Date(); inicio.setDate(inicio.getDate() - dias);
  const inicioStr = inicio.toISOString();
  ['graficoFaturamento','graficoDias','dashServicos','dashHorarios'].forEach(id => { const el=document.getElementById(id); if(el) el.innerHTML='<div class="dash-loading">Carregando...</div>'; });
  ['kpiAgendVal','kpiClientesVal','kpiFaturadoVal','kpiTicketVal'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent='—'; });
  let agendamentos = [];
  try { agendamentos = (await buscarTodosAgendamentos()).filter(a => !a.criadoEm || a.criadoEm >= inicioStr); }
  catch (e) { /* ignora */ }
  const set = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  const pagos = agendamentos.filter(a => a.status !== 'cancelado');
  const totalFaturado = pagos.reduce((s,a) => s + parseFloat(a.total||0), 0);
  set('kpiAgendVal',    pagos.length);
  set('kpiClientesVal', new Set(pagos.map(a=>a.telefone||a.email||a.cliente)).size);
  set('kpiFaturadoVal', 'R$ ' + totalFaturado.toFixed(0));
  set('kpiTicketVal',   'R$ ' + (pagos.length ? (totalFaturado/pagos.length).toFixed(0) : '0'));
  set('kpiAgendSub', 'nos últimos ' + dias + ' dias');
  set('kpiClientesSub', 'nos últimos ' + dias + ' dias');
  if (!pagos.length) { ['graficoFaturamento','graficoDias','da{hServicos','dashHorarios'].forEach(id => { const el=document.getElementById(id); if(el) el.innerHTML='<div class="dash-loading">📭 Sem dados no período.</div>'; }); return; }
  // Gráfico de barras simples: dias da semana
  const conts = [0,0,0,0,0,0,0];
  const nomes = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  pagos.forEach(a => { const dt=new Date(a.criadoEm||Date.now()); conts[dt.getDay()]++; });
  const maxC = Math.max(...conts, 1);
  const grafico = document.getElementById('graficoDias');
  if (grafico) grafico.innerHTML = `<div class="dash-bar-wrap">${conts.map((c,i)=>`<div class="dash-bar-row"><span class="dash-bar-label">${nomes[i]}</span><div class="dash-bar-track"><div class="dash-bar-fill" style="width:${(c/maxC*100).toFixed(0)}%"></div></div><span class="dash-bar-val">${c}</span></div>`).join('')}</div>`;
  // Serviços
  const svcMap = {};
  pagos.forEach(a => { (a.servicos||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(sv=>{ svcMap[sv]=(svcMap[sv]||0)+1; }); });
  const rankSvcs = Object.entries(svcMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const dashSvcs = document.getElementById('dashServicos');
  if (dashSvcs) dashSvcs.innerHTML = rankSvcs.map(([nome,cont],i)=>`<div class="dash-svc-item"><span class="dash-svc-pos">${i+1}</span><span class="dash-svc-nome">${nome}</span><div class="dash-svc-barra"><div class="dash-svc-barra-fill" style="width:${(cont/rankSvcs[0][1]*100).toFixed(0)}%"></div></div><span class="dash-svc-cont">${cont}x</span></div>`).join('');
  const graficoFat = document.getElementById('graficoFaturamento');
  if (graficoFat) graficoFat.innerHTML = '<div class="dash-loading" style="font-size:0.75rem">Dados do período carregados acima ↑</div>';
  const dashHor = document.getElementById('dashHorarios');
  if (dashHor) {
    const horMap = {};
    pagos.forEach(a=>{ if(a.horario) horMap[a.horario]=(horMap[a.horario]||0)+1; });
    const rank = Object.entries(horMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
    dashHor.innerHTML = rank.length ? rank.map(([hora,cont])=>`<div class="dash-hora-item"><span class="dash-hora-tempo">${hora}</span><div class="dash-hora-barra-wrap"><div class="dash-bar-track" style="height:10px"><div class="dash-bar-fill verde" style="width:${(cont/rank[0][1]*100).toFixed(0)}%"></div></div></div><span class="dash-hora-cont">${cont}x</span></div>`).join('') : '<div class="dash-loading">Sem dados</div>';
  }
}

/* ── CRM ── */
let _crmClientes = {};
let _crmFiltroAtual = 'todos';
let _crmClienteAtual = null;

export async function carregarCRM() {
  document.getElementById('crmGrid').innerHTML = '<div class="crm-loading">⏳ Carregando clientes…</div>';
  _crmClientes = {};
  const agendamentos = await buscarTodosAgendamentos().catch(() => []);
  _crmClientes = agruparPorCliente(agendamentos);
  const obs = await carregarObservacoes();
  Object.keys(obs).forEach(k => { if (_crmClientes[k]) _crmClientes[k].obs = obs[k]; });
  const todos    = Object.values(_crmClientes);
  const vip      = todos.filter(c => c.agendamentos.length >= CRM_VIP_VISITAS);
  const inativos = todos.filter(c => diasDesde(c.agendamentos[0]?.data) > CRM_INATIVO_DIAS);
  const novos    = todos.filter(c => c.agendamentos.length === 1);
  ['crmStatTotal','crmStatVip','crmStatInativos','crmStatNovos'].forEach((id,i) => {
    const el = document.getElementById(id); if(el) el.textContent = [todos.length,vip.length,inativos.length,novos.length][i];
  });
  renderCRM();
}

function renderCRM() {
  const grid   = document.getElementById('crmGrid');
  const busca  = (document.getElementById('crmSearch')?.value||'').toLowerCase().trim();
  let lista = Object.entries(_crmClientes).map(([key,c])=>({key,...c}));
  lista = lista.filter(c => {
    const v = c.agendamentos.length, d = diasDesde(c.agendamentos[0]?.data), inativo = d > CRM_INATIVO_DIAS;
    if (_crmFiltroAtual==='vip')     return v >= CRM_VIP_VISITAS;
    if (_crmFiltroAtual==='regular') return v>=2 && v<CRM_VIP_VISITAS && !inativo;
    if (_crmFiltroAtual==='inativo') return inativo;
    return true;
  });
  if (busca) lista = lista.filter(c => c.nome.toLowerCase().includes(busca) || c.email.includes(busca) || c.tel.replace(/\D/g,'').includes(busca.replace(/\D/g,'')));
  lista.sort((a,b) => b.agendamentos.length - a.agendamentos.length);
  if (!lista.length) { grid.innerHTML = '<div class="crm-empty">Nenhum cliente encontrado.</div>'; return; }
  const maxV = Math.max(...lista.map(c=>c.agendamentos.length), 1);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  grid.innerHTML = '';
  lista.forEach(c => {
    const v = c.agendamentos.length, ult = c.agendamentos[0], d = diasDesde(ult?.data);
    const inativo = d > CRM_INATIVO_DIAS, vip = v >= CRM_VIP_VISITAS, novo = v === 1;
    let badges = '';
    if (vip) badges += '<span class="crm-badge-vip">⭐ VIP</span>'; else if (novo) badges += '<span class="crm-badge-novo">✨ Novo</span>';
    if (inativo) badges += '<span class="crm-badge-inativo">⚠ Inativo</span>';
    const top = rankServicos(c.agendamentos).slice(0,3).map(([sv])=>`<span class="service-tag">${esc(sv)}</span>`).join('');
    const card = document.createElement('div'); card.className = 'crm-card' + (inativo ? ' inativo-card' : '');
    card.innerHTML = `<div class="crm-card-left"><div class="crm-card-name">${esc(c.nome)} ${badges}</div>
      <div class="crm-meta"><span class="crm-meta-item">${[c.tel?'📱 '+c.tel:'',c.email?'✉ '+c.email:''].filter(Boolean).join(' · ')||'<em>sem contato</em>'}</span><span class="crm-meta-item">📅 Último: <strong>${ult?.data||'—'}</strong></span></div>
      <div class="crm-servicos-top">${top}</div>${c.obs?`<div class="crm-obs-preview">📝 ${esc(c.obs)}</div>`:''}</div>
      <div class="crm-card-right"><span class="crm-visitas-big">${v}</span><span class="crm-visitas-label">visita${v!==1?'s':''}</span><div class="crm-freq-bar"><div class="crm-freq-fill" style="width:${Math.round(v/maxV*100)}%"></div></div></div>`;
    card.addEventListener('click', () => abrirClienteCRM(c.key));
    grid.appendChild(card);
  });
}

export function setCrmFiltro(f) {
  _crmFiltroAtual = f;
  ['Todos','Vip','Regular','Inativo'].forEach(n => { document.getElementById('crmF'+n)?.classList.toggle('active', n.toLowerCase()===f||(f==='todos'&&n==='Todos')); });
  renderCRM();
}

function abrirClienteCRM(key) {
  const c = _crmClientes[key]; if (!c) return;
  _crmClienteAtual = key;
  document.getElementById('crmModalNome').textContent = c.nome;
  const contEl = document.getElementById('crmModalContato'); contEl.innerHTML = '';
  if (c.tel) { const a=document.createElement('a'); a.href='https://wa.me/55'+c.tel.replace(/\D/g,''); a.target='_blank'; a.textContent='📱 '+c.tel; contEl.appendChild(a); }
  if (c.email) { const span=document.createElement('span'); span.textContent='✉ '+c.email; contEl.appendChild(span); }
  const total = c.agendamentos.reduce((s,a)=>s+(parseFloat(a.total)||0),0);
  const iv = intervaloMedio(c.agendamentos);
  ['crmKpiVisitas','crmKpiGasto','crmKpiIntervalo'].forEach((id,i) => {
    const el=document.getElementById(id); if(el) el.textContent=[c.agendamentos.length,'R$'+total.toFixed(0),iv?iv+'d':'—'][i];
  });
  const top = rankServicos(c.agendamentos).slice(0,5);
  document.getElementById('crmModalServicos').innerHTML = top.map(([sv,n])=>`<span class="service-tag">${sv} (${n}x)</span>`).join(' ') || '<span style="color:var(--gray2)">—</span>';
  document.getElementById('crmModalHistorico').innerHTML = c.agendamentos.map(ag=>`<div class="crm-hist-item"><div><div class="crm-hist-date">${ag.data||'—'}</div><div class="crm-hist-time">${ag.horario||''}</div></div><div><div class="crm-hist-svc">${ag.servicos||'—'}</div>${ag.total?`<div class="crm-hist-total">R$ ${Number(ag.total).toFixed(2)}</div>`:''}</div></div>`).join('');
  document.getElementById('crmObsArea').value = c.obs || '';
  document.getElementById('crmModalOverlay').classList.remove('hidden');
}

export function fecharCrmModal(e) { if (e.target.id==='crmModalOverlay') document.getElementById('crmModalOverlay').classList.add('hidden'); }

export async function salvarObsCRM() {
  const key = _crmClienteAtual; if (!key) return;
  const obs = document.getElementById('crmObsArea').value.trim();
  if (_crmClientes[key]) _crmClientes[key].obs = obs;
  try { await salvarObservacao(key, obs); showToast('✅ Observação salva!'); } catch (e) { showToast('❌ Erro: '+e.message); }
  renderCRM();
}

/* ══════════════════════════════════════════
   PORTFÓLIO DO BARBEIRO — ADMIN
══════════════════════════════════════════ */

// renderPortfolioAdmin, adicionarFotoPortfolio, removerFotoPortfolio
// são importadas de galeria.js e re-expostas globalmente aqui
// (stubs para compatibilidade com código que chame diretamente)
export { renderPortfolioAdmin, adicionarFotoPortfolio, removerFotoPortfolio };

/* ══════════════════════════════════════════
   HISTÓRICO DE ATENDIMENTO
══════════════════════════════════════════ */

let _histAtendBarbeiroId   = null;
let _histAtendBarbeiroNome = '';
let _histAtendTodos        = [];   // cache de todos os agendamentos do barbeiro

/* ── Seletor de barbeiro ── */
export function trocarBarbeiroHistorico() {
  _histAtendBarbeiroId   = null;
  _histAtendBarbeiroNome = '';
  _histAtendTodos        = [];

  document.getElementById('histAtendListStep').style.display = 'none';
  document.getElementById('histAtendBarbStep').style.display = 'block';

  const grid = document.getElementById('histAtendBarbGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const ativos = (adminSettings.barbeiros || []).filter(b => b.ativo !== false);
  if (!ativos.length) {
    grid.innerHTML = '<div class="atend-sem-data">Nenhum barbeiro ativo cadastrado.</div>';
    return;
  }
  ativos.forEach(b => {
    const card = document.createElement('div');
    card.className = 'atend-barb-card';
    const fotoInner = b.foto
      ? `<img src="${b.foto}" alt="${b.nome}" onerror="this.parentElement.textContent='${b.emoji||'💈'}'">` 
      : (b.emoji || '💈');
    card.innerHTML = `<div class="atend-barb-emoji">${fotoInner}</div><div class="atend-barb-nome">${b.nome}</div>`;
    card.onclick = () => selecionarBarbeiroHistorico(b.id, b.nome);
    grid.appendChild(card);
  });
}

async function selecionarBarbeiroHistorico(id, nome) {
  _histAtendBarbeiroId   = id;
  _histAtendBarbeiroNome = nome;

  document.getElementById('histAtendBarbStep').style.display  = 'none';
  document.getElementById('histAtendListStep').style.display  = 'block';

  const label = document.getElementById('histAtendBarbLabel');
  if (label) label.textContent = '💈 ' + nome;

  const busca = document.getElementById('histAtendBusca');
  if (busca) busca.value = '';

  const lista = document.getElementById('histAtendLista');
  if (lista) lista.innerHTML = '<div class="atend-sem-data" style="text-align:center;padding:2rem">⏳ Carregando histórico...</div>';

  const stats = document.getElementById('histAtendStats');
  if (stats) stats.innerHTML = '';

  try {
    const todos = await buscarTodosAgendamentos();
    _histAtendTodos = todos
      .filter(a => a.barbeiroId === id && a.status !== 'cancelado')
      .sort((a, b) => {
        // Ordena por data desc: "DD/MM/YYYY HH:MM" combinado
        const ta = _histDateToSort(a.data, a.horario);
        const tb = _histDateToSort(b.data, b.horario);
        return tb - ta;
      });
  } catch (e) {
    _histAtendTodos = [];
    if (lista) lista.innerHTML = `<div class="atend-sem-data" style="color:var(--red)">Erro ao carregar: ${e.message}</div>`;
    return;
  }

  renderHistoricoAtend();
}

/* Converte "DD/MM/YYYY" + "HH:MM" → timestamp para ordenação */
function _histDateToSort(dataBR, horario) {
  if (!dataBR) return 0;
  const [d, m, y] = dataBR.split('/').map(Number);
  const [h = 0, min = 0] = (horario || '').split(':').map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
}

/* ── Renderiza a lista (com filtro de busca aplicado) ── */
function renderHistoricoAtend(busca = '') {
  const lista  = document.getElementById('histAtendLista');
  const stats  = document.getElementById('histAtendStats');
  if (!lista) return;

  const termo = busca.trim().toLowerCase();
  const dados = termo
    ? _histAtendTodos.filter(a =>
        (a.cliente   || '').toLowerCase().includes(termo) ||
        (a.telefone  || '').replace(/\D/g,'').includes(termo.replace(/\D/g,'')) ||
        (a.servicos  || '').toLowerCase().includes(termo))
    : _histAtendTodos;

  // Stats
  if (stats) {
    const total    = _histAtendTodos.length;
    const faturado = _histAtendTodos.reduce((s, a) => s + parseFloat(a.total || 0), 0);
    stats.innerHTML = `
      <div class="hist-atend-stat"><span class="hist-atend-stat-n">${total}</span><span class="hist-atend-stat-l">Atendimentos</span></div>
      <div class="hist-atend-stat"><span class="hist-atend-stat-n">R$ ${faturado.toFixed(0)}</span><span class="hist-atend-stat-l">Faturado</span></div>
      <div class="hist-atend-stat"><span class="hist-atend-stat-n">R$ ${total ? (faturado/total).toFixed(0) : '0'}</span><span class="hist-atend-stat-l">Ticket médio</span></div>`;
  }

  if (!dados.length) {
    lista.innerHTML = `<div class="atend-sem-data">${termo ? 'Nenhum resultado para "'+busca+'".' : 'Nenhum atendimento registrado para '+_histAtendBarbeiroNome+'.'}</div>`;
    return;
  }

  lista.innerHTML = '';
  dados.forEach(a => {
    const svcs = (a.servicos || '').split(', ').map(s => `<span class="service-tag">${s}</span>`).join('');
    const card = document.createElement('div');
    card.className = 'hist-atend-card';
    card.innerHTML = `
      <div class="hist-atend-datetime">
        <div class="hist-atend-data">${a.data || '—'}</div>
        <div class="hist-atend-hora">${a.horario || ''}</div>
      </div>
      <div class="hist-atend-info">
        <div class="hist-atend-cliente">👤 ${a.cliente || '—'}</div>
        ${a.telefone ? `<div class="hist-atend-tel">📱 ${a.telefone}</div>` : ''}
        <div class="hist-atend-svcs">${svcs || '<em style="color:var(--gray2)">Sem serviço</em>'}</div>
      </div>
      <div class="hist-atend-valor">${a.total ? 'R$ ' + Number(a.total).toFixed(2) : '—'}</div>`;
    lista.appendChild(card);
  });
}

export function filtrarHistoricoAtend() {
  const busca = document.getElementById('histAtendBusca')?.value || '';
  renderHistoricoAtend(busca);
}

/* ══════════════════════════════════════════
   DIAS BLOQUEADOS POR BARBEIRO
══════════════════════════════════════════ */

/* ── Carrega do Firestore ── */
export async function carregarBloqueiosBarb() {
  if (!window._fb) { renderBloqueiosBarb(); return; }
  try {
    const { collection, getDocs, query, orderBy, db } = window._fb;
    const q = query(collection(db, 'dias_bloqueados'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    adminSettings.diasBloqueadosBarbeiro = [];
    snap.forEach(doc => adminSettings.diasBloqueadosBarbeiro.push({ id: doc.id, ...doc.data() }));
  } catch (e) {
    // Firestore pode não ter o índice ainda; tenta sem ordenação
    try {
      const { collection, getDocs, db } = window._fb;
      const snap = await getDocs(collection(db, 'dias_bloqueados'));
      adminSettings.diasBloqueadosBarbeiro = [];
      snap.forEach(doc => adminSettings.diasBloqueadosBarbeiro.push({ id: doc.id, ...doc.data() }));
    } catch (_) { /* ignora */ }
  }
  renderBloqueiosBarb();
}

/* ── Renderiza a lista na aba Dias ── */
export function renderBloqueiosBarb() {
  const lista  = document.getElementById('listaBloqueiosBarb');
  const empty  = document.getElementById('listaBloqueiosBarbEmpty');
  const filtro = document.getElementById('filtroBloqueioBarb');
  if (!lista) return;

  // Popula o filtro com os barbeiros
  if (filtro) {
    const val = filtro.value;
    filtro.innerHTML = '<option value="">Todos os barbeiros</option>';
    (adminSettings.barbeiros || []).forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id; opt.textContent = b.nome;
      filtro.appendChild(opt);
    });
    filtro.value = val;
  }

  const filtroVal = filtro?.value || '';
  const bloqueios = (adminSettings.diasBloqueadosBarbeiro || [])
    .filter(b => !filtroVal || b.barber_id === filtroVal)
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  lista.innerHTML = '';
  if (!bloqueios.length) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  const dayNames   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  bloqueios.forEach(item => {
    const barb = (adminSettings.barbeiros || []).find(b => b.id === item.barber_id);
    const barbNome  = barb?.nome || 'Barbeiro';
    const barbEmoji = barb?.emoji || '💈';
    // date formato ISO YYYY-MM-DD
    const [y, m, d] = item.date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const friendly = dayNames[dt.getDay()] + ', ' + String(d).padStart(2,'0') + ' ' + monthNames[m-1] + ' ' + y;

    const row = document.createElement('div');
    row.className = 'barb-bloq-item';
    row.innerHTML = `
      <div class="barb-bloq-info">
        <div class="barb-bloq-nome">${barbEmoji} ${barbNome}</div>
        <div class="barb-bloq-data">🔒 ${friendly}</div>
        ${item.reason ? `<div class="barb-bloq-motivo">📝 ${item.reason}</div>` : '<div class="barb-bloq-motivo" style="font-style:italic">Sem motivo registrado</div>'}
      </div>
      <button class="barb-bloq-del" title="Desbloquear este dia" onclick="removerBloqueioBarb('${item.id}')">✕</button>`;
    lista.appendChild(row);
  });
}

/* ── Abre o modal ── */
export function openModalBloqueioBarb() {
  const sel = document.getElementById('bloqueioBarberSelect');
  if (sel) {
    sel.innerHTML = '<option value="">Selecione o barbeiro...</option>';
    (adminSettings.barbeiros || []).filter(b => b.ativo !== false).forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id; opt.textContent = (b.emoji || '💈') + ' ' + b.nome;
      sel.appendChild(opt);
    });
    sel.value = '';
  }
  const dateStep = document.getElementById('bloqueioDateStep');
  if (dateStep) dateStep.style.display = 'none';
  const dateInput = document.getElementById('bloqueioDateInput');
  if (dateInput) {
    dateInput.value = '';
    dateInput.min   = new Date().toISOString().split('T')[0];
  }
  const reasonInput = document.getElementById('bloqueioReason');
  if (reasonInput) reasonInput.value = '';
  const alertEl = document.getElementById('bloqueioAgendAlert');
  if (alertEl) alertEl.style.display = 'none';
  document.getElementById('bloqueioErr')?.classList.remove('show');
  document.getElementById('overlayBloqueioBarb')?.classList.add('show');
}

export function closeModalBloqueioBarb() {
  document.getElementById('overlayBloqueioBarb')?.classList.remove('show');
}

/* ── Barbeiro selecionado → revela datepicker ── */
export async function onBarbeiroBloqueioChange() {
  const barb_id   = document.getElementById('bloqueioBarberSelect')?.value;
  const dateStep  = document.getElementById('bloqueioDateStep');
  const alertEl   = document.getElementById('bloqueioAgendAlert');
  if (!barb_id) {
    if (dateStep) dateStep.style.display = 'none';
    return;
  }
  if (dateStep) dateStep.style.display = 'block';
  if (alertEl)  alertEl.style.display  = 'none';
}

/* ── Data selecionada → verifica agendamentos existentes ── */
export async function onDataBloqueioChange() {
  const barb_id  = document.getElementById('bloqueioBarberSelect')?.value;
  const dateISO  = document.getElementById('bloqueioDateInput')?.value;
  const alertEl  = document.getElementById('bloqueioAgendAlert');
  if (!barb_id || !dateISO || !alertEl) return;

  alertEl.style.display = 'none';
  // Converter ISO → formato Firestore DD/MM/YYYY
  const [y, m, d] = dateISO.split('-');
  const dateFS    = `${d}/${m}/${y}`;
  try {
    const todos = await buscarAgendamentosDoDia(dateFS);
    const count = todos.filter(a => a.barbeiroId === barb_id).length;
    if (count > 0) {
      alertEl.innerHTML = `<span class="bloqueio-agend-alert-icon">⚠️</span>
        <span>Já existem <strong>${count} agendamento${count > 1 ? 's' : ''}</strong> para este barbeiro neste dia.
        Eles <strong>não serão cancelados</strong> automaticamente — você precisará comunicar o cliente manualmente.</span>`;
      alertEl.style.display = 'flex';
    }
  } catch (_) { /* ignora erros de rede */ }
}

/* ── Confirma o bloqueio ── */
export async function confirmarBloqueioBarb() {
  const barb_id = document.getElementById('bloqueioBarberSelect')?.value;
  const dateISO = document.getElementById('bloqueioDateInput')?.value;
  const reason  = document.getElementById('bloqueioReason')?.value.trim() || null;
  const errEl   = document.getElementById('bloqueioErr');

  if (!barb_id) {
    if (errEl) { errEl.textContent = 'Selecione um barbeiro.'; errEl.classList.add('show'); }
    return;
  }
  if (!dateISO) {
    if (errEl) { errEl.textContent = 'Selecione uma data.'; errEl.classList.add('show'); }
    return;
  }
  // Não permitir datas passadas
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const [y, m, d] = dateISO.split('-').map(Number);
  const dataSel = new Date(y, m-1, d);
  if (dataSel < hoje) {
    if (errEl) { errEl.textContent = 'Não é possível bloquear datas passadas.'; errEl.classList.add('show'); }
    return;
  }
  // Verificar duplicata
  const jaExiste = (adminSettings.diasBloqueadosBarbeiro || []).some(
    b => b.barber_id === barb_id && b.date === dateISO
  );
  if (jaExiste) {
    const barb = (adminSettings.barbeiros || []).find(b => b.id === barb_id);
    if (errEl) { errEl.textContent = `${barb?.nome || 'Este barbeiro'} já está bloqueado nesta data.`; errEl.classList.add('show'); }
    return;
  }
  if (errEl) errEl.classList.remove('show');

  const novoDoc = { barber_id: barb_id, date: dateISO, reason, created_at: new Date().toISOString() };

  // Salva no Firestore
  if (window._fb) {
    try {
      const ref = await window._fb.addDoc(window._fb.collection(window._fb.db, 'dias_bloqueados'), novoDoc);
      novoDoc.id = ref.id;
    } catch (e) {
      showToast('❌ Erro ao salvar: ' + e.message);
      return;
    }
  } else {
    novoDoc.id = 'local_' + Date.now();
  }

  if (!adminSettings.diasBloqueadosBarbeiro) adminSettings.diasBloqueadosBarbeiro = [];
  adminSettings.diasBloqueadosBarbeiro.push(novoDoc);

  const barb = (adminSettings.barbeiros || []).find(b => b.id === barb_id);
  closeModalBloqueioBarb();
  renderBloqueiosBarb();
  showToast(`🔒 ${barb?.nome || 'Barbeiro'} bloqueado em ${d.toString().padStart(2,'0')}/${m.toString().padStart(2,'0')}/${y}!`);
}

/* ── Remove um bloqueio ── */
export async function removerBloqueioBarb(id) {
  if (!confirm('Desbloquear este dia para este barbeiro?')) return;
  if (window._fb && !id.startsWith('local_')) {
    try {
      await window._fb.deleteDoc(window._fb.doc(window._fb.db, 'dias_bloqueados', id));
    } catch (e) {
      showToast('❌ Erro ao remover: ' + e.message);
      return;
    }
  }
  adminSettings.diasBloqueadosBarbeiro = (adminSettings.diasBloqueadosBarbeiro || []).filter(b => b.id !== id);
  renderBloqueiosBarb();
  showToast('✓ Dia desbloqueado com sucesso.');
}

/* ── Expõe todos os globais ── */
window.openAdmin           = openAdmin;
window.closeAdmin          = closeAdmin;
window.doAdminLogin        = doAdminLogin;
window.adminLogout         = adminLogout;
window.switchAdmTab        = switchAdmTab;
window.saveAdminSettings   = saveAdminSettings;
window.toggleShopStatus    = toggleShopStatus;
window.updateWorkHour      = updateWorkHour;
window.openAddBlockedDate  = openAddBlockedDate;
window.closeAddBlockedDate = closeAddBlockedDate;
window.confirmAddBlockedDate=confirmAddBlockedDate;
window.removeBlockedDate   = removeBlockedDate;
window.aplicarDuracaoPadrao= aplicarDuracaoPadrao;
window.toggleSlot          = toggleSlot;
window.deleteSlot          = deleteSlot;
window.openAddSlotModal    = openAddSlotModal;
window.closeAddSlotModal   = closeAddSlotModal;
window.confirmAddSlot      = confirmAddSlot;
window.toggleSvcVis        = toggleSvcVis;
window.filtrarServicosAdmin   = filtrarServicosAdmin;
window.deleteSvc           = deleteSvc;
window.openAddSvcModal     = openAddSvcModal;
window.openEditSvcModal    = openEditSvcModal;
window.closeAddSvcModal    = closeAddSvcModal;
window.confirmSaveService  = confirmSaveService;
window.svcFotoSelecionada  = svcFotoSelecionada;
window.removerFotoSvc      = removerFotoSvc;
window.abrirModalBarbeiro  = abrirModalBarbeiro;
window.fecharModalBarbeiro = fecharModalBarbeiro;
window.atualizarPreviewFoto= atualizarPreviewFoto;
window.selecionarEmoji     = selecionarEmoji;
window.onBarbFotoChange    = onBarbFotoChange;
window.removerFotoBarbeiro = removerFotoBarbeiro;
window.toggleDiaBarb       = toggleDiaBarb;
window.confirmarSalvarBarbeiro = confirmarSalvarBarbeiro;
window.toggleAtivoBarbeiro = toggleAtivoBarbeiro;
window.excluirBarbeiro     = excluirBarbeiro;
window.prevMonthAtend      = prevMonthAtend;
window.nextMonthAtend      = nextMonthAtend;
window.trocarBarbeiro      = trocarBarbeiro;
window.imprimirAgendaDoDia = imprimirAgendaDoDia;
window.exportarAgendaImagem = exportarAgendaImagem;
window.exportarAtendimentosPDF=exportarAtendimentosPDF;
window.gerarStory          = gerarStory;
window.baixarStory         = baixarStory;
window.compartilharStory   = compartilharStory;
window.fazerBackupJSON     = fazerBackupJSON;
window.importarBackupJSON  = importarBackupJSON;
window.restaurarBackupFirestore=restaurarBackupFirestore;
window.excluirBackup       = excluirBackup;
window.carregarHistoricoBackup=carregarHistoricoBackup;
window.carregarSolicitacoes= carregarSolicitacoes;
window.filtrarSolicitacoes = filtrarSolicitacoes;
window.responderSolicitacao= responderSolicitacao;
window.salvarPoliticaReembolso=salvarPoliticaReembolso;
window.carregarDashboard   = carregarDashboard;
window.carregarCRM         = carregarCRM;
window.setCrmFiltro        = setCrmFiltro;
window.fecharCrmModal      = fecharCrmModal;
window.salvarObsCRM        = salvarObsCRM;
window.trocarBarbeiroHistorico  = trocarBarbeiroHistorico;
window.filtrarHistoricoAtend    = filtrarHistoricoAtend;

/* ── Marcar atendimento como realizado + incrementa contador ── */
export async function marcarAtendimentoRealizado(agendId, barbId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳…'; }
  try {
    if (agendId && window._fb) {
      await window._fb.setDoc(
        window._fb.doc(window._fb.db, 'agendamentos', agendId),
        { realizado: true },
        { merge: true }
      );
    }
    incrementarContadorCortes(barbId);
    await saveAdminSettings();
    showToast('✅ Atendimento concluído! Contador atualizado.');
    if (btn) { btn.textContent = '✓ Realizado'; btn.classList.add('done'); }
    import('./agendamento.js').then(m => m.renderBarbeiroGrid());
  } catch(e) {
    showToast('❌ Erro ao concluir: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '✓ Concluir'; }
  }
}

window.renderPortfolioAdmin     = renderPortfolioAdmin;
window.adicionarFotoPortfolio   = adicionarFotoPortfolio;
window.removerFotoPortfolio     = removerFotoPortfolio;
window.triggerUploadFoto        = triggerUploadFoto;
window.onPortFileChange         = onPortFileChange;
window.toggleDestaquePortfolio  = toggleDestaquePortfolio;
window.atualizarLimitePortfolio = atualizarLimitePortfolio;
window.abrirEditarTagsFoto      = abrirEditarTagsFoto;
window.galeAdmDragStart         = galeAdmDragStart;
window.galeAdmDragOver          = galeAdmDragOver;
window.galeAdmDrop              = galeAdmDrop;
window.galeAdmDragEnd           = galeAdmDragEnd;
window.incrementarContadorCortes = incrementarContadorCortes;
window.marcarAtendimentoRealizado = marcarAtendimentoRealizado;
window.carregarBloqueiosBarb    = carregarBloqueiosBarb;
window.renderBloqueiosBarb      = renderBloqueiosBarb;
window.openModalBloqueioBarb    = openModalBloqueioBarb;
window.closeModalBloqueioBarb   = closeModalBloqueioBarb;
window.onBarbeiroBloqueioChange = onBarbeiroBloqueioChange;
window.onDataBloqueioChange     = onDataBloqueioChange;
window.confirmarBloqueioBarb    = confirmarBloqueioBarb;
window.removerBloqueioBarb      = removerBloqueioBarb;
window.imprimirAgendaDoDia     = imprimirAgendaDoDia;
window.exportarAgendaImagem    = exportarAgendaImagem;
