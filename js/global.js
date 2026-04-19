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
export const setCart = (newCart) => { cart = newCart; };
export const addToCartArr = (item) => { cart.push(item); };
export const removeFromCartArr = (id) => { cart = cart.filter(c => c.id !== id); };

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
  if (!tag) return;

  const autoOpen   = adminSettings.shopOpen && isWithinWorkHours();
  const forcedOpen = adminSettings.shopOpen;   // admin ligou o toggle manualmente

  // Aberto apenas se: toggle ligado E dentro do horário de funcionamento
  if (autoOpen) {
    tag.className   = 'hero-tag open';
    tag.textContent = '🔴 Aberto agora · Luziânia, GO';
  } else if (forcedOpen) {
    // Toggle ligado mas fora do horário → mostra "abre às X"
    const dow = new Date().getDay();
    const h   = adminSettings.workHours[dow];
    const msg = adminSettings.workDays.includes(dow) && h
      ? `⚫ Fechado · Abre às ${h.open}`
      : '⚫ Fechado hoje';
    tag.className   = 'hero-tag closed';
    tag.textContent = msg;
  } else {
    tag.className   = 'hero-tag closed';
    tag.textContent = '⚫ Fechado no momento';
  }

  // Sincroniza o toggle do painel admin
  const toggle = document.getElementById('shopOpenToggle');
  if (toggle && toggle.checked !== adminSettings.shopOpen) toggle.checked = adminSettings.shopOpen;

  // Sincroniza título/subtítulo do painel Status
  const title = document.getElementById('statusToggleTitle');
  const sub   = document.getElementById('statusToggleSub');
  if (title) title.textContent = autoOpen ? '🟢 Aberto Agora' : '⚫ Fechado no Momento';
  if (sub)   sub.textContent   = autoOpen
    ? 'A barbearia está recebendo clientes'
    : (!adminSettings.shopOpen ? 'A barbearia está fechada (manual)' : 'Fora do horário de funcionamento');
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
