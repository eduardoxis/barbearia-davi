/* ══════════════════════════════════════════
   GLOBAL.JS — Estado, helpers e UI compartilhada
   Barbearia do Davi
══════════════════════════════════════════ */

/* ── Estado global da aplicação ── */
export const adminSettings = {
  shopOpen: true,
  workDays: [1,2,3,4,5,6],
  blockedDates: [],
  diasBloqueadosBarbeiro: [], // bloqueios individuais por barbeiro
  workHours: {
    0: {open:'08:00', close:'18:00'},
    1: {open:'08:00', close:'19:00'},
    2: {open:'08:00', close:'19:00'},
    3: {open:'08:00', close:'19:00'},
    4: {open:'08:00', close:'19:00'},
    5: {open:'08:00', close:'19:00'},
    6: {open:'08:00', close:'17:00'},
  },
  slots: ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'],
  takenSlots: [],
  duracaoPadrao: 60,
  politicaReembolso: {
    reembolsoAtivo:      true,
    remarcacaoAtiva:     true,
    prazoReembolsoDias:  1,
    prazoRemarcacaoDias: 1,
    maxRemarcacoes:      2,
    taxaPlataforma:      0,
    tipoReembolso:       'integral',
  },
  barbeiros: [
    {
      id: 'davi',
      nome: 'Davi',
      foto: '',
      emoji: '💈',
      especialidade: 'Degradê & Barba',
      bio: '',
      portfolio: [],
      diasAtendimento: [1,2,3,4,5,6],
      horarioInicio: '08:00',
      horarioFim: '18:00',
      intervalo: 60,
      takenSlots: [],
      ativo: true,
      email: '',   // e-mail de acesso ao painel do barbeiro
      senha: '',   // senha de acesso ao painel do barbeiro
    }
  ],
  services: [
    {id:'degrade',    name:'Degradê',         desc:'Fade profissional com máquina. Resultado clean e moderno.',     price:30, time:'1h', icon:'💈', bg:'gi-degrade'},
    {id:'corte',      name:'Corte Clássico',  desc:'Tesoura e pente, acabamento impecável para qualquer estilo.',   price:30, time:'1h', icon:'✂️', bg:'gi-corte'},
    {id:'infantil',   name:'Corte Infantil',  desc:'Corte especial para os pequenos, com paciência e carinho.',     price:30, time:'1h', icon:'👦', bg:'gi-infantil'},
    {id:'maquina',    name:'Corte Máquina',   desc:'Corte na máquina com um pente. Rápido e eficiente.',           price:25, time:'1h', icon:'⚡', bg:'gi-maquina'},
    {id:'barba',      name:'Barba Completa',  desc:'Aparar, modelar e hidratar. Navalha quente incluída.',         price:25, time:'1h', icon:'🪒', bg:'gi-barba'},
    {id:'combo',      name:'Corte + Barba',   desc:'O combo perfeito. Corte + barba com acabamento premium.',      price:45, time:'1h', icon:'✨', bg:'gi-combo'},
    {id:'sobrancelha',name:'Sobrancelha',     desc:'Modelagem e alinhamento preciso das sobrancelhas.',            price:15, time:'1h', icon:'👁', bg:'gi-sobrancelha'},
    {id:'hot',        name:'Hot Towel Shave', desc:'Barbear clássico com toalha quente. Experiência premium.',     price:40, time:'1h', icon:'🔥', bg:'gi-hot'},
  ]
};

export const booking = {
  client:'', phone:'', email:'', date:'', time:'',
  step:0, barbeiro:null, remarcacoes:0, termoAceito:false
};

export let cart = [];

/* ── Persistência do carrinho no localStorage ── */
const CART_KEY    = 'bbdavi_cart';    // salva IDs dos serviços
const BOOKING_KEY = 'bbdavi_booking'; // salva barbeiro, data, hora, step

export function saveCartToStorage() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart.map(c => c.id)));
    localStorage.setItem(BOOKING_KEY, JSON.stringify({
      barbeiroId: booking.barbeiro?.id || null,
      date:       booking.date,
      time:       booking.time,
      step:       booking.step,
      client:     booking.client,
      phone:      booking.phone,
    }));
  } catch (_) {}
}

export function clearCartStorage() {
  try { localStorage.removeItem(CART_KEY); localStorage.removeItem(BOOKING_KEY); } catch (_) {}
}

/** Chamado após adminSettings estar pronto — restaura carrinho e estado do booking */
export function restoreCartFromStorage(adminSettings) {
  try {
    const ids     = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    const saved   = JSON.parse(localStorage.getItem(BOOKING_KEY) || '{}');
    if (!ids.length) return false;

    // Restaura serviços do carrinho
    const restoredCart = ids
      .map(id => adminSettings.services?.find(s => s.id === id))
      .filter(Boolean);
    if (!restoredCart.length) return false;
    cart = restoredCart;

    // Restaura dados do booking
    if (saved.barbeiroId) {
      const barb = (adminSettings.barbeiros || []).find(b => b.id === saved.barbeiroId);
      if (barb) booking.barbeiro = barb;
    }
    if (saved.date)   booking.date   = saved.date;
    if (saved.time)   booking.time   = saved.time;
    if (saved.step)   booking.step   = Math.min(saved.step, 3); // nunca restaura além da revisão
    if (saved.client) booking.client = saved.client;
    if (saved.phone)  booking.phone  = saved.phone;

    return true;
  } catch (_) { return false; }
}

export const setCart          = (newCart) => { cart = newCart; };
export const addToCartArr     = (item)    => { cart.push(item); };
export const removeFromCartArr = (id)     => { cart = cart.filter(c => c.id !== id); };

/* ── Constantes ── */
export const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
export const DAYS_SHORT_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
export const DAYS_FULL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

/* ── Toast ── */
let toastT;
export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ── Lógica automática de horário de funcionamento ── */
export function isWithinWorkHours() {
  const now  = new Date();
  const dow  = now.getDay();                                     // 0=Dom … 6=Sáb
  const mins = now.getHours() * 60 + now.getMinutes();           // minutos desde meia-noite

  if (!adminSettings.workDays.includes(dow)) return false;       // dia não trabalha

  const h = adminSettings.workHours[dow] || { open: '08:00', close: '18:00' };
  const [oh, om] = h.open.split(':').map(Number);
  const [ch, cm] = h.close.split(':').map(Number);
  const openMin  = oh * 60 + om;
  const closeMin = ch * 60 + cm;

  return mins >= openMin && mins < closeMin;
}

/* ── Hero status (combina toggle manual + horário automático) ── */
export function updateHeroStatus() {
  const tag = document.getElementById('heroStatusTag');

  // Barra de status no topo
  const pageBar  = document.getElementById('pageStatusBar');
  const psbText  = document.getElementById('psbText');

  const autoOpen   = adminSettings.shopOpen && isWithinWorkHours();
  const forcedOpen = adminSettings.shopOpen;

  if (autoOpen) {
    if (tag) { tag.className = 'hero-tag open'; tag.textContent = '🔴 Aberto agora · Luziânia, GO'; }
    if (pageBar) pageBar.className = 'page-status-bar open';
    if (psbText) psbText.textContent = 'Aberto agora · Luziânia, GO';
  } else if (forcedOpen) {
    const dow = new Date().getDay();
    const h   = adminSettings.workHours[dow];
    const msg = adminSettings.workDays.includes(dow) && h
      ? `Fechado · Abre às ${h.open}`
      : 'Fechado hoje';
    if (tag) { tag.className = 'hero-tag closed'; tag.textContent = '⚫ ' + msg; }
    if (pageBar) pageBar.className = 'page-status-bar closed';
    if (psbText) psbText.textContent = msg;
  } else {
    if (tag) { tag.className = 'hero-tag closed'; tag.textContent = '⚫ Fechado no momento'; }
    if (pageBar) pageBar.className = 'page-status-bar closed';
    if (psbText) psbText.textContent = 'Fechado no momento';
  }

  // Badge ABERTO HOJE
  const badge = document.getElementById('heroBadge');
  if (badge) {
    const mainEl = badge.querySelector('.hero-badge-main');
    if (autoOpen) {
      badge.style.display = 'flex';
      if (mainEl) mainEl.innerHTML = 'ABERTO<br><span>HOJE</span>';
    } else {
      if (mainEl) mainEl.innerHTML = 'FECHADO<br><span>AGORA</span>';
    }
  }

  // Sincroniza o toggle do painel admin
  const toggle = document.getElementById('shopOpenToggle');
  if (toggle && toggle.checked !== adminSettings.shopOpen) toggle.checked = adminSettings.shopOpen;

  const title = document.getElementById('statusToggleTitle');
  const sub   = document.getElementById('statusToggleSub');
  if (title) title.textContent = autoOpen ? '🟢 Aberto Agora' : '⚫ Fechado no Momento';
  if (sub)   sub.textContent   = autoOpen
    ? 'A barbearia está recebendo clientes'
    : (!adminSettings.shopOpen ? 'A barbearia está fechada (manual)' : 'Fora do horário de funcionamento');

  // Foto do barbeiro no hero (usa o primeiro barbeiro com foto)
  _updateHeroPhoto();

  // Cards de serviços no hero
  _updateHeroSvcCards();
}

function _updateHeroPhoto() {
  const img   = document.getElementById('heroPhotoPrincipal');
  const right = img?.closest('.hero-right');
  if (!img) return;

  // 1. URL direta salva no admin (prioridade máxima)
  // Aceita tanto URLs http/https quanto base64 (data:image/...)
  const urlDireta = adminSettings.heroFotoUrl || '';
  if (urlDireta && (urlDireta.startsWith('http') || urlDireta.startsWith('data:'))) {
    img.src = urlDireta;
    img.style.display = 'block';
    const ph = document.getElementById('heroPhotoPlaceholder');
    if (ph) ph.style.display = 'none';
    if (right) right.classList.add('tem-foto');
    return;
  }

  // 2. Primeira foto do portfolio de algum barbeiro ativo
  const barbs = adminSettings.barbeiros || [];
  for (const b of barbs) {
    if (b.ativo === false) continue;
    const url = (b.portfolio || []).find(f => f.destaque)?.url
             || b.portfolio?.[0]?.url
             || b.foto || '';
    if (url && (url.startsWith('http') || url.startsWith('data:'))) {
      img.src = url;
      img.style.display = 'block';
      const ph = document.getElementById('heroPhotoPlaceholder');
      if (ph) ph.style.display = 'none';
      if (right) right.classList.add('tem-foto');
      return;
    }
  }

  // Sem foto: mostra placeholder mas mantém hero-right visível
  img.style.display = 'none';
  const placeholder = document.getElementById('heroPhotoPlaceholder');
  if (placeholder) placeholder.style.display = 'flex';
  // hero-right sempre visível agora (display:flex no CSS)
}

function _updateHeroSvcCards() {
  const wrap = document.getElementById('heroSvcCards');
  if (!wrap) return;
  const svcs = (adminSettings.services || []).filter(s => !s.hidden).slice(0, 3);
  if (!svcs.length) return;
  const svgIcons = [
    `<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`,
    `<svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 1 5 5c0 3-2 5-5 7-3-2-5-4-5-7a5 5 0 0 1 5-5z"/><path d="M4 22c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
    `<svg viewBox="0 0 24 24"><path d="M3 10 Q12 4 21 10"/><path d="M3 10 Q5 14 12 13 Q19 14 21 10"/><circle cx="12" cy="11.5" r="1.5" fill="currentColor" stroke="none"/></svg>`,
    `<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/></svg>`,
    `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
    `<svg viewBox="0 0 24 24"><path d="M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z"/></svg>`,
  ];
  wrap.innerHTML = svcs.map((s, i) => {
    const iconIsImg = s.icon && (s.icon.startsWith('http') || s.icon.startsWith('data:'));
    const fotoHtml = iconIsImg
      ? `<div class="hero-svc-foto" data-hero-svc="${s.id}"><img src="${s.icon}" style="width:100%;height:100%;object-fit:cover;border-radius:4px" alt="${s.name}" onerror="this.parentElement.innerHTML='';this.parentElement.style.background='linear-gradient(135deg,#1a1a1a,#333)'"></div>`
      : `<div class="hero-svc-foto" data-hero-svc="${s.id}" style="background:${s.bg||'linear-gradient(135deg,#1a1a1a,#333)'};display:flex;align-items:center;justify-content:center;font-size:1.2rem">${s.temFoto ? '' : (s.icon || '')}</div>`;
    return `<div class="hero-svc-card">
      <div class="hero-svc-icon">${svgIcons[i] || svgIcons[0]}</div>
      <div>
        <div class="hero-svc-nome">${s.name}</div>
        <div class="hero-svc-desc">${s.desc || ''}</div>
      </div>
      ${fotoHtml}
    </div>`;
  }).join('');

  // Lazy-load fotos que ainda não estão na memória
  const fb = window._fb;
  if (!fb) return;
  svcs.forEach(s => {
    const iconIsImg = s.icon && (s.icon.startsWith('http') || s.icon.startsWith('data:'));
    if (s.temFoto && !iconIsImg) {
      fb.getDoc(fb.doc(fb.db, 'fotos_servicos', s.id)).then(snap => {
        if (!snap.exists()) return;
        const url = snap.data().url;
        s.icon = url;
        const el = document.querySelector(`.hero-svc-foto[data-hero-svc="${s.id}"]`);
        if (el) el.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:4px" alt="${s.name}">`;
      }).catch(() => {});
    }
  });
}

/* ── Inicia a atualização automática a cada 60 s ── */
let _autoStatusInterval = null;
export function startAutoShopStatus() {
  if (_autoStatusInterval) return;           // evita duplicatas
  updateHeroStatus();                        // roda imediatamente
  _autoStatusInterval = setInterval(() => {
    updateHeroStatus();
  }, 60_000);                                // verifica a cada 1 min
}

/* ── Nav user ── */
export function updateNavUserFb() {
  const btn = document.getElementById('navUserBtn');
  if (!btn) return;
  if (window.fbUser) {
    const parts = window.fbUser.name.split(' ');
    const display = parts[0] + (parts.length > 1 ? ' ' + parts[parts.length-1] : '');
    btn.textContent = '👤 ' + display;
    btn.classList.add('logged');
    const loggedInfo = document.getElementById('drawerLoggedInfo');
    const guestInfo = document.getElementById('drawerGuestInfo');
    const dName = document.getElementById('drawerUserName');
    const dEmail = document.getElementById('drawerUserEmail');
    if (loggedInfo) loggedInfo.style.display = 'flex';
    if (guestInfo) guestInfo.style.display = 'none';
    if (dName) dName.textContent = window.fbUser.name;
    if (dEmail) dEmail.textContent = window.fbUser.email;
    if (window.fbUser.isAdmin) {
      const da = document.getElementById('drawerAdminBtn');
      if (da) da.classList.add('show');
    }
    if (window.fbUser.isBarbeiro) {
      const db = document.getElementById('drawerBarbeiroBtn');
      if (db) db.classList.add('show');
      // Mostra botão "Painel Barbeiro" na nav desktop
      const nb = document.getElementById('navBarbeiroBtn');
      if (nb) nb.style.display = 'flex';
      // Persiste sessão do barbeiro no localStorage
      try { localStorage.setItem('bbdavi_barbeiro', JSON.stringify(window.fbUser)); } catch (_) {}
    }
  } else {
    btn.textContent = '👤 Entrar';
    btn.classList.remove('logged');
    const loggedInfo = document.getElementById('drawerLoggedInfo');
    const guestInfo = document.getElementById('drawerGuestInfo');
    if (loggedInfo) loggedInfo.style.display = 'none';
    if (guestInfo) guestInfo.style.display = 'block';
    const da = document.getElementById('drawerAdminBtn');
    if (da) da.classList.remove('show');
    const db2 = document.getElementById('drawerBarbeiroBtn');
    if (db2) db2.classList.remove('show');
    const nb2 = document.getElementById('navBarbeiroBtn');
    if (nb2) nb2.style.display = 'none';
    hideAdminNavBtn();
  }
}

export function showAdminNavBtn() {
  const b = document.getElementById('navAdminBtn');
  if (b) b.style.display = 'flex';
}

export function hideAdminNavBtn() {
  const b = document.getElementById('navAdminBtn');
  if (b) b.style.display = 'none';
}

/* ── Drawer mobile ── */
export function toggleDrawer() {
  document.getElementById('hamburger')?.classList.toggle('open');
  document.getElementById('mobileDrawer')?.classList.toggle('open');
  document.getElementById('drawerOverlay')?.classList.toggle('open');
  document.body.style.overflow = document.getElementById('mobileDrawer')?.classList.contains('open') ? 'hidden' : '';
}

export function closeDrawer() {
  document.getElementById('hamburger')?.classList.remove('open');
  document.getElementById('mobileDrawer')?.classList.remove('open');
  document.getElementById('drawerOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Helpers ── */
export function togglePass(inputId, btn) {
  const inp = document.getElementById(inputId);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}

export function parseDateBR(str) {
  if (!str) return null;
  const p = str.split('/');
  if (p.length !== 3) return null;
  return new Date(p[2], p[1]-1, p[0]);
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

/* ── Expose globals para atributos onclick inline no HTML ── */
window.toggleDrawer = toggleDrawer;
window.closeDrawer  = closeDrawer;
window.togglePass   = togglePass;
window.showToast    = showToast;

/* Inicia o loop automático assim que o módulo é carregado */
startAutoShopStatus();

/* ── Reidrata sessão do barbeiro do localStorage ao carregar a página ── */
(function rehydrateBarbeiro() {
  try {
    const cached = localStorage.getItem('bbdavi_barbeiro');
    if (cached) {
      const user = JSON.parse(cached);
      if (user?.isBarbeiro && user?.barbeiroId) {
        window.fbUser = user;
        // Aguarda DOM estar pronto para atualizar a nav
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', updateNavUserFb);
        } else {
          updateNavUserFb();
        }
      }
    }
  } catch (_) {}
})();

/* ══════════════════════════════════════════
   TEMA — sempre modo escuro
══════════════════════════════════════════ */
document.documentElement.setAttribute('data-theme', 'dark');
