/* ══════════════════════════════════════════
   ADMIN.JS — Painel administrativo completo
   Barbearia do Davi
══════════════════════════════════════════ */

import { adminSettings, showToast, MONTHS_PT, DAYS_SHORT_PT, DAYS_FULL } from './global.js';
import { buscarTodosAgendamentos, buscarAgendamentosDoDia } from '../routes/agendamentos.js';
import { gerarHorariosBarbeiro } from '../routes/barbeiros.js';
import { agruparPorCliente, diasDesde, intervaloMedio, rankServicos, salvarObservacao, carregarObservacoes, CRM_INATIVO_DIAS, CRM_VIP_VISITAS } from '../routes/clientes.js';
import { buscarTodosCupons, criarCupom, editarCupom, toggleCupom, excluirCupom } from '../routes/cupons.js';

/* ── Estado calendário de atendimentos ── */
let atendAno = new Date().getFullYear();
let atendMes = new Date().getMonth();
let atendData = '';

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
  const tabs = ['dashboard','barbeiros','status','funcionamento','dias','horarios','servicos','atendimentos','backup','solicitacoes','clientes','cupons'];
  document.querySelectorAll('.adm-tab').forEach((t, i) => t.classList.toggle('active', tabs[i] === tab));
  document.querySelectorAll('.adm-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('admTab-' + tab)?.classList.add('active');
  if (tab === 'funcionamento') renderFuncionamento();
  if (tab === 'atendimentos')  renderAtendCal();
  if (tab === 'backup')        carregarHistoricoBackup();
  if (tab === 'solicitacoes')  { carregarSolicitacoes(); carregarPoliticaReembolsoForm(); }
  if (tab === 'dashboard')     carregarDashboard();
  if (tab === 'barbeiros')     renderBarbeirosAdmin();
  if (tab === 'clientes')      carregarCRM();
  if (tab === 'cupons')        carregarCupons();
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
function renderAdminServices() {
  const list = document.getElementById('adminServicesList');
  if (!list) return;
  list.innerHTML = '';
  adminSettings.services.forEach(svc => {
    const row = document.createElement('div');
    row.className = 'svc-editor-card' + (svc.hidden ? ' hidden-svc' : '');
    row.innerHTML = `<div class="svc-ed-icon">${svc.icon}</div>
      <div class="svc-ed-info">
        <div class="svc-ed-name">${svc.name}</div>
        <div class="svc-ed-desc">${svc.desc || '—'}</div>
        <div class="svc-ed-meta">
          <span class="svc-ed-tag svc-ed-price">R$ ${svc.price}</span>
          <span class="svc-ed-tag svc-ed-time">⏱ ${svc.time}</span>
        </div>
      </div>
      <div class="svc-ed-actions">
        <button class="svc-ed-btn" onclick="openEditSvcModal('${svc.id}')">✏ Editar</button>
        <button class="svc-ed-btn" onclick="toggleSvcVis('${svc.id}')">${svc.hidden?'👁 Mostrar':'🙈 Ocultar'}</button>
        <button class="svc-ed-btn" onclick="deleteSvc('${svc.id}')">✕</button>
      </div>`;
    list.appendChild(row);
  });
  updateAdminStats();
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

let editingSvcId = null;
export function openAddSvcModal() {
  editingSvcId = null;
  document.getElementById('svcModalTitle').textContent = '+ Novo Serviço';
  ['svcIcon','svcName','svcDesc','svcTime'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('svcIcon').value = '✂️';
  document.getElementById('svcTime').value = '30min';
  document.getElementById('svcPrice').value = '';
  document.getElementById('svcErr').classList.remove('show');
  document.getElementById('addSvcOverlay').classList.add('show');
}
export function openEditSvcModal(id) {
  editingSvcId = id;
  const svc = adminSettings.services.find(s => s.id === id); if (!svc) return;
  document.getElementById('svcModalTitle').textContent = '✏ Editar Serviço';
  document.getElementById('svcIcon').value  = svc.icon;
  document.getElementById('svcName').value  = svc.name;
  document.getElementById('svcDesc').value  = svc.desc || '';
  document.getElementById('svcPrice').value = svc.price;
  document.getElementById('svcTime').value  = svc.time;
  document.getElementById('svcErr').classList.remove('show');
  document.getElementById('addSvcOverlay').classList.add('show');
}
export function closeAddSvcModal() { document.getElementById('addSvcOverlay').classList.remove('show'); }
export function confirmSaveService() {
  const name  = document.getElementById('svcName').value.trim();
  const price = parseFloat(document.getElementById('svcPrice').value);
  if (!name || isNaN(price)) { document.getElementById('svcErr').classList.add('show'); return; }
  document.getElementById('svcErr').classList.remove('show');
  const icon = document.getElementById('svcIcon').value.trim() || '✂️';
  const desc = document.getElementById('svcDesc').value.trim();
  const time = document.getElementById('svcTime').value.trim() || '30min';
  if (editingSvcId) {
    const svc = adminSettings.services.find(s => s.id === editingSvcId);
    if (svc) Object.assign(svc, { icon, name, desc, price, time });
    showToast('✓ Atualizado!');
  } else {
    adminSettings.services.push({ id:'svc_'+Date.now(), name, desc, price, time, icon, bg:'gi-corte', hidden:false });
    showToast('✓ Adicionado!');
  }
  closeAddSvcModal(); renderAdminServices(); import('./index.js').then(m => m.renderGallery());
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
  _barbEmojiSelecionado = barb?.emoji || '💈';
  const diasAtivos = barb?.diasAtendimento || [1,2,3,4,5,6];
  document.querySelectorAll('#barbDiasGrid .barb-dia-btn').forEach(btn => {
    btn.classList.toggle('on', diasAtivos.includes(parseInt(btn.dataset.dia)));
  });
  atualizarPreviewFoto(barb?.foto || '');
  document.getElementById('erroBarbeiro')?.classList.remove('show');
  document.getElementById('overlayModalBarbeiro').classList.add('show');
}
export function fecharModalBarbeiro() { document.getElementById('overlayModalBarbeiro').classList.remove('show'); }
export function atualizarPreviewFoto(url) {
  const prev = document.getElementById('barb-foto-preview');
  if (!prev) return;
  prev.innerHTML = url ? `<img src="${url}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.textContent='${_barbEmojiSelecionado}'">` : _barbEmojiSelecionado;
}
export function selecionarEmoji(btn, emoji) {
  _barbEmojiSelecionado = emoji;
  if (!document.getElementById('barbFotoUrl')?.value) {
    const prev = document.getElementById('barb-foto-preview');
    if (prev) prev.textContent = emoji;
  }
}
export function toggleDiaBarb(btn) { btn.classList.toggle('on'); }
export function confirmarSalvarBarbeiro() {
  const nome = document.getElementById('barbNome')?.value.trim();
  if (!nome) { document.getElementById('erroBarbeiro').classList.add('show'); return; }
  document.getElementById('erroBarbeiro').classList.remove('show');
  const id = document.getElementById('barbIdEditando').value || 'barb_' + Date.now();
  const barbeiro = {
    id, nome,
    foto:            document.getElementById('barbFotoUrl')?.value.trim() || '',
    emoji:           _barbEmojiSelecionado,
    especialidade:   document.getElementById('barbEsp')?.value.trim() || '',
    diasAtendimento: [...document.querySelectorAll('#barbDiasGrid .barb-dia-btn.on')].map(b => parseInt(b.dataset.dia)),
    horarioInicio:   document.getElementById('barbHorarioInicio')?.value || '08:00',
    horarioFim:      document.getElementById('barbHorarioFim')?.value || '18:00',
    intervalo:       parseInt(document.getElementById('barbIntervalo')?.value || '60'),
    ativo:           document.getElementById('barbAtivo')?.value === 'true',
    takenSlots:      (adminSettings.barbeiros||[]).find(b=>b.id===id)?.takenSlots || [],
  };
  if (!adminSettings.barbeiros) adminSettings.barbeiros = [];
  const idx = adminSettings.barbeiros.findIndex(b => b.id === id);
  if (idx >= 0) adminSettings.barbeiros[idx] = barbeiro; else adminSettings.barbeiros.push(barbeiro);
  fecharModalBarbeiro(); renderBarbeirosAdmin();
  import('./agendamento.js').then(m => m.renderBarbeiroGrid());
  showToast(idx >= 0 ? '✓ Barbeiro atualizado!' : '✓ Barbeiro adicionado!');
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
    el.onclick = () => { document.querySelectorAll('#atendCalGrid .cal-day').forEach(d=>d.classList.remove('selected')); el.classList.add('selected'); atendData = ds; carregarAtendimentosDoDia(ds); };
    grid.appendChild(el);
  }
}
export function prevMonthAtend() { atendMes--; if(atendMes<0){atendMes=11;atendAno--;} renderAtendCal(); }
export function nextMonthAtend() { atendMes++; if(atendMes>11){atendMes=0;atendAno++;} renderAtendCal(); }

async function carregarAtendimentosDoDia(data) {
  document.getElementById('atendDataTitulo').textContent = 'Atendimentos — ' + data;
  const lista = document.getElementById('atendLista');
  lista.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--gray)">Carregando...</div>';
  const agendamentos = await buscarAgendamentosDoDia(data);
  lista.innerHTML = '';
  const dur = adminSettings.duracaoPadrao || 60;
  const durLabel = dur >= 60 ? (dur===60?'1h':(dur/60).toFixed(1).replace('.0','')+'h') : dur+'min';
  [...adminSettings.slots].sort().forEach(horario => {
    const bloqueado = adminSettings.takenSlots.includes(horario);
    const reserva   = agendamentos.find(a => a.horario === horario);
    const card = document.createElement('div');
    const base = `<div><div class="atend-hora">${horario}</div><div class="atend-duracao">⏱ ${durLabel}</div>`;
    if (bloqueado) {
      card.className = 'card-atendimento bloqueado';
      card.innerHTML = base + '<span class="atend-badge bloqueado">🔴 Bloqueado</span></div><div class="atend-info"><div class="atend-livre-msg">Horário bloqueado</div></div>';
    } else if (reserva) {
      const svcs = (reserva.servicos||'').split(', ').map(s=>`<span class="service-tag">${s}</span>`).join('');
      card.className = 'card-atendimento reservado';
      card.innerHTML = base + '<span class="atend-badge reservado">🟠 Reservado</span></div><div class="atend-info"><div class="atend-cliente-nome">👤 '+(reserva.cliente||'—')+'</div><div class="atend-cliente-tel">📱 '+(reserva.telefone||reserva.whatsapp||'—')+'</div><div class="atend-servicos">'+svcs+'</div><div class="atend-total">R$ '+(reserva.total||'—')+'</div></div>';
    } else {
      card.className = 'card-atendimento livre';
      card.innerHTML = base + '<span class="atend-badge livre">🟢 Livre</span></div><div class="atend-info"><div class="atend-livre-msg">Disponível</div></div>';
    }
    lista.appendChild(card);
  });
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
  if (!pagos.length) { ['graficoFaturamento','graficoDias','dashServicos','dashHorarios'].forEach(id => { const el=document.getElementById(id); if(el) el.innerHTML='<div class="dash-loading">📭 Sem dados no período.</div>'; }); return; }
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
window.deleteSvc           = deleteSvc;
window.openAddSvcModal     = openAddSvcModal;
window.openEditSvcModal    = openEditSvcModal;
window.closeAddSvcModal    = closeAddSvcModal;
window.confirmSaveService  = confirmSaveService;
window.abrirModalBarbeiro  = abrirModalBarbeiro;
window.fecharModalBarbeiro = fecharModalBarbeiro;
window.atualizarPreviewFoto= atualizarPreviewFoto;
window.selecionarEmoji     = selecionarEmoji;
window.toggleDiaBarb       = toggleDiaBarb;
window.confirmarSalvarBarbeiro = confirmarSalvarBarbeiro;
window.toggleAtivoBarbeiro = toggleAtivoBarbeiro;
window.excluirBarbeiro     = excluirBarbeiro;
window.prevMonthAtend      = prevMonthAtend;
window.nextMonthAtend      = nextMonthAtend;
window.exportarAtendimentosPDF=exportarAtendimentosPDF;
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

/* ══════════════════════════════════════════════════════════════
   CUPONS — CRUD completo no painel admin
══════════════════════════════════════════════════════════════ */

let _cupomEditando = null; // código do cupom em edição

/* ── Injeta o modal no DOM uma única vez (separado da lista) ── */
function _garantirModalCupom() {
  if (document.getElementById('cupomOverlay')) return; // já existe

  const el = document.createElement('div');
  el.id = 'cupomOverlay';
  el.className = 'adm-overlay';
  el.style.display = 'none';
  el.innerHTML = `
    <div class="adm-modal" style="max-width:420px">
      <div class="adm-modal-header">
        <span id="cupomModalTitle">Novo Cupom</span>
        <button class="adm-modal-close" onclick="fecharModalCupom()">✕</button>
      </div>
      <div class="adm-modal-body" style="display:flex;flex-direction:column;gap:0.9rem">

        <div class="adm-field">
          <label>Código <span style="color:var(--red)">*</span></label>
          <input id="cupomCodigo" type="text" placeholder="Ex: DAVIBARBER10"
            style="text-transform:uppercase"
            oninput="this.value=this.value.toUpperCase().replace(/\\s/g,'')">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem">
          <div class="adm-field">
            <label>Tipo</label>
            <select id="cupomTipo">
              <option value="percentual">Porcentagem (%)</option>
              <option value="fixo">Valor fixo (R$)</option>
            </select>
          </div>
          <div class="adm-field">
            <label>Valor <span style="color:var(--red)">*</span></label>
            <input id="cupomValor" type="number" min="0" step="0.01" placeholder="0">
          </div>
        </div>

        <div class="adm-field">
          <label>Descrição</label>
          <input id="cupomDescricao" type="text" placeholder="Ex: 10% de desconto para novos clientes">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem">
          <div class="adm-field">
            <label>Data de expiração</label>
            <input id="cupomExpiracao" type="date">
          </div>
          <div class="adm-field">
            <label>Máx. de usos</label>
            <input id="cupomMaxUsos" type="number" min="1" placeholder="Ilimitado">
          </div>
        </div>

        <label style="display:flex;align-items:center;gap:0.6rem;cursor:pointer;font-size:0.85rem;color:var(--gray)">
          <input id="cupomAtivo" type="checkbox" checked> Ativo ao salvar
        </label>

        <div id="cupomErro" style="display:none;color:var(--red);font-size:0.8rem"></div>

        <div style="display:flex;gap:0.6rem;justify-content:flex-end;margin-top:0.4rem">
          <button class="adm-btn secondary" onclick="fecharModalCupom()">Cancelar</button>
          <button id="cupomSalvarBtn" class="adm-btn" onclick="salvarCupomAdmin()">Salvar</button>
        </div>
      </div>
    </div>`;

  // Fecha ao clicar fora do modal
  el.addEventListener('click', e => { if (e.target === el) fecharModalCupom(); });
  document.body.appendChild(el);
}

/* ── Carrega e renderiza APENAS a lista de cupons ────────────── */
export async function carregarCupons() {
  _garantirModalCupom(); // garante modal no DOM antes de qualquer coisa

  const wrap = document.getElementById('admTab-cupons');
  if (!wrap) return;

  // Spinner sem destruir o modal (que agora está no body)
  wrap.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--gray2)">Carregando...</div>';

  const cupons = await buscarTodosCupons();

  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  const linhas = cupons.map(c => {
    const exp      = c.dataExpiracao ? new Date(c.dataExpiracao + 'T23:59:59') : null;
    const expirado = exp && exp < new Date();
    const usos     = c.maxUsos ? `${c.usosFeitos || 0}/${c.maxUsos}` : `${c.usosFeitos || 0}/∞`;
    const badge    = c.ativo && !expirado
      ? '<span class="cupom-badge ativo">Ativo</span>'
      : expirado
        ? '<span class="cupom-badge expirado">Expirado</span>'
        : '<span class="cupom-badge inativo">Inativo</span>';
    const desconto = c.tipo === 'percentual'
      ? `${c.valor}%`
      : `R$ ${Number(c.valor).toFixed(2)}`;

    return `<tr>
      <td><code style="font-size:0.85rem;letter-spacing:.04em">${c.codigo}</code></td>
      <td>${desconto}</td>
      <td style="font-size:0.78rem;color:var(--gray2)">${c.dataExpiracao || '—'}</td>
      <td>${usos}</td>
      <td>${badge}</td>
      <td class="cupom-acoes">
        <button class="cupom-btn-edit"   onclick="abrirModalCupom('${c.codigo}')">✏️</button>
        <button class="cupom-btn-toggle" onclick="toggleCupomAdmin('${c.codigo}',${!c.ativo})">${c.ativo ? '🔴' : '🟢'}</button>
        <button class="cupom-btn-del"    onclick="excluirCupomAdmin('${c.codigo}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="cupons-header">
      <h3 style="font-family:'Oswald',sans-serif;font-size:1.1rem;color:var(--white);margin:0">🏷️ Cupons de Desconto</h3>
      <button class="adm-btn" onclick="abrirModalCupom(null)">+ Novo Cupom</button>
    </div>
    ${cupons.length === 0
      ? '<div style="text-align:center;padding:2rem;color:var(--gray2)">Nenhum cupom cadastrado.</div>'
      : `<div style="overflow-x:auto">
          <table class="cupons-table">
            <thead><tr>
              <th>Código</th><th>Desconto</th><th>Expira em</th><th>Usos</th><th>Status</th><th>Ações</th>
            </tr></thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>`
    }`;
}

/* ── Abre modal (criar ou editar) ───────────────────────────── */
export async function abrirModalCupom(codigo) {
  _garantirModalCupom();

  _cupomEditando = codigo || null;

  // Reseta TODOS os campos
  const get = id => document.getElementById(id);
  ['cupomCodigo','cupomDescricao','cupomExpiracao','cupomMaxUsos','cupomValor'].forEach(id => {
    const el = get(id); if (el) el.value = '';
  });
  const tipoEl = get('cupomTipo');
  if (tipoEl) tipoEl.value = 'percentual';
  const atvEl = get('cupomAtivo');
  if (atvEl) atvEl.checked = true;
  const erroEl = get('cupomErro');
  if (erroEl) { erroEl.style.display = 'none'; erroEl.textContent = ''; }
  const tituloEl = get('cupomModalTitle');
  if (tituloEl) tituloEl.textContent = codigo ? 'Editar Cupom' : 'Novo Cupom';
  const codEl = get('cupomCodigo');
  if (codEl) codEl.disabled = false;
  const btnEl = get('cupomSalvarBtn');
  if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Salvar'; }

  // Se for edição: busca o cupom e preenche os campos ANTES de abrir
  if (codigo) {
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Carregando...'; }
    try {
      const lista = await buscarTodosCupons();
      const c = lista.find(x => x.codigo === codigo);
      if (c) {
        const set = (id, val) => { const el = get(id); if (el) el.value = val ?? ''; };
        set('cupomCodigo',    c.codigo);
        set('cupomValor',     c.valor);
        set('cupomDescricao', c.descricao || '');
        set('cupomExpiracao', c.dataExpiracao || '');
        set('cupomMaxUsos',   c.maxUsos || '');
        if (tipoEl) tipoEl.value = c.tipo || 'percentual';
        if (atvEl)  atvEl.checked = !!c.ativo;
        if (codEl)  codEl.disabled = true; // código não pode ser alterado
      }
    } catch (e) {
      console.warn('[cupom] Erro ao buscar dados para edição:', e);
    }
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Salvar'; }
  }

  const ov = document.getElementById('cupomOverlay');
  if (ov) ov.style.display = 'flex';
}

export function fecharModalCupom() {
  const ov = document.getElementById('cupomOverlay');
  if (ov) ov.style.display = 'none';
  _cupomEditando = null;
}

/* ── Salva (criar ou editar) ─────────────────────────────────── */
export async function salvarCupomAdmin() {
  const erroEl = document.getElementById('cupomErro');
  const btnEl  = document.getElementById('cupomSalvarBtn');
  const get    = id => document.getElementById(id)?.value.trim();

  const dados = {
    codigo:        get('cupomCodigo'),
    tipo:          get('cupomTipo') || 'percentual',
    valor:         get('cupomValor'),
    descricao:     get('cupomDescricao'),
    dataExpiracao: get('cupomExpiracao') || null,
    maxUsos:       get('cupomMaxUsos') || null,
    ativo:         document.getElementById('cupomAtivo')?.checked !== false,
  };

  if (!dados.codigo) {
    if (erroEl) { erroEl.textContent = 'Informe o código do cupom.'; erroEl.style.display = 'block'; }
    return;
  }
  if (!dados.valor || Number(dados.valor) <= 0) {
    if (erroEl) { erroEl.textContent = 'Informe um valor maior que zero.'; erroEl.style.display = 'block'; }
    return;
  }

  if (erroEl) { erroEl.style.display = 'none'; erroEl.textContent = ''; }
  if (btnEl)  { btnEl.disabled = true; btnEl.textContent = 'Salvando...'; }

  try {
    if (_cupomEditando) {
      await editarCupom(_cupomEditando, dados);
      showToast('✅ Cupom atualizado!');
    } else {
      await criarCupom(dados);
      showToast('✅ Cupom criado!');
    }
    fecharModalCupom();
    carregarCupons();
  } catch (e) {
    if (erroEl) { erroEl.textContent = e.message; erroEl.style.display = 'block'; }
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Salvar'; }
  }
}

/* ── Toggle ativo/inativo ────────────────────────────────────── */
export async function toggleCupomAdmin(codigo, novoEstado) {
  try {
    await toggleCupom(codigo, novoEstado);
    showToast(novoEstado ? '🟢 Cupom ativado!' : '🔴 Cupom desativado!');
    carregarCupons();
  } catch (e) { showToast('Erro: ' + e.message); }
}

/* ── Exclui cupom ───────────────────────────────────────────── */
export async function excluirCupomAdmin(codigo) {
  if (!confirm(`Excluir cupom "${codigo}"? Esta ação não pode ser desfeita.`)) return;
  try {
    await excluirCupom(codigo);
    showToast('🗑️ Cupom excluído.');
    carregarCupons();
  } catch (e) { showToast('Erro: ' + e.message); }
}

/* ── Expõe globais ──────────────────────────────────────────── */
window.carregarCupons     = carregarCupons;
window.abrirModalCupom    = abrirModalCupom;
window.fecharModalCupom   = fecharModalCupom;
window.salvarCupomAdmin   = salvarCupomAdmin;
window.toggleCupomAdmin   = toggleCupomAdmin;
window.excluirCupomAdmin  = excluirCupomAdmin;
