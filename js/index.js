/* ══════════════════════════════════════════
   INDEX.JS — Galeria de serviços, carrinho, init
   Barbearia do Davi
══════════════════════════════════════════ */

import {
  adminSettings, booking, cart, addToCartArr, removeFromCartArr,
  saveCartToStorage, clearCartStorage, restoreCartFromStorage,
  showToast, updateHeroStatus, updateNavUserFb, showAdminNavBtn
} from './global.js';
import { startRealtimeSync } from './realtime.js';

/* ── Renderiza galeria de serviços ── */
export function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  grid.innerHTML = '';
  adminSettings.services.filter(s => !s.hidden).forEach(svc => {
    const inCart = cart.find(c => c.id === svc.id);
    const card = document.createElement('div');
    card.className = 'gallery-card' + (inCart ? ' in-cart' : '');
    card.innerHTML = `
      ${inCart ? '<div class="in-cart-badge">✓ Adicionado</div>' : ''}
      <div class="gallery-img ${svc.bg}">
        ${svc.icon && (svc.icon.startsWith('http') || svc.icon.startsWith('data:'))
          ? `<img src="${svc.icon}" class="gallery-img-foto" alt="${svc.name}" loading="lazy">`
          : (svc.icon || '✂️')}
      </div>
      <div class="gallery-body">
        <div class="gallery-name">${svc.name}</div>
        <div class="gallery-desc">${svc.desc}</div>
        <div class="gallery-footer">
          <div><div class="gallery-price">R$ ${svc.price}</div><div class="gallery-time">⏱ ${svc.time}</div></div>
          ${inCart
            ? `<button class="remove-btn" onclick="removeFromCart('${svc.id}',event)">✕</button>`
            : `<button class="add-btn" onclick="addToCart('${svc.id}',event)">+</button>`}
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

/* ── Adiciona ao carrinho ── */
export function addToCart(id, e) {
  e && e.stopPropagation();
  const svc = adminSettings.services.find(s => s.id === id);
  if (!svc || cart.find(c => c.id === id)) return;
  addToCartArr({ ...svc });
  saveCartToStorage();
  updateCartUI();
  renderGallery();
  showToast('✓ ' + svc.name + ' adicionado!');
}

/* ── Remove do carrinho ── */
export function removeFromCart(id, e) {
  e && e.stopPropagation();
  removeFromCartArr(id);
  saveCartToStorage();
  updateCartUI();
  renderGallery();
}

/* ── Atualiza UI do carrinho ── */
export function updateCartUI() {
  const total = cart.reduce((s, c) => s + parseFloat(c.price) || 0, 0);
  const totalDisplay  = document.getElementById('cartTotalDisplay');
  const totalPanel    = document.getElementById('cartTotalPanel');
  const cartCount     = document.getElementById('cartCount');
  const navCartBadge  = document.getElementById('navCartBadge');

  if (totalDisplay) totalDisplay.textContent = 'R$ ' + total;
  if (totalPanel)   totalPanel.textContent   = 'R$ ' + total;
  if (cartCount)    cartCount.textContent    = cart.length;
  if (navCartBadge) navCartBadge.textContent = cart.length;

  const items = document.getElementById('cartItems');
  if (items) {
    if (!cart.length) {
      items.innerHTML = '<div class="cart-empty">Nenhum serviço adicionado.</div>';
    } else {
      items.innerHTML = cart.map(c => `
        <div class="cart-item">
          <div>
            <div class="cart-item-name">${
              (c.icon && (c.icon.startsWith('http') || c.icon.startsWith('data:')))
                ? `<img src="${c.icon}" style="width:20px;height:20px;object-fit:cover;border-radius:3px;vertical-align:middle;margin-right:4px" onerror="this.style.display='none'">`
                : (c.icon ? c.icon + ' ' : '')
            }${c.name}</div>
            <div style="font-size:0.68rem;color:var(--gray)">⏱ ${c.time}</div>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem">
            <span class="cart-item-price">R$ ${c.price}</span>
            <button class="remove-btn" onclick="removeFromCart('${c.id}')" style="width:28px;height:28px;font-size:0.8rem">✕</button>
          </div>
        </div>`).join('');
    }
  }
}

/* ── Toggle carrinho ── */
export function toggleCart() {
  const panel   = document.getElementById('cartPanel');
  const overlay = document.getElementById('cartOverlay');
  const isOpen  = panel.classList.toggle('open');
  overlay.classList.toggle('open', isOpen);
}

/* ── Inicializa o site (carrega configs do Firestore) ── */
export async function initSite() {
  // Aguarda Firebase
  let attempts = 0;
  while (!window._fb && attempts < 40) { await new Promise(r => setTimeout(r, 100)); attempts++; }

  if (window._fb) {
    try {
      const snap = await window._fb.getDoc(window._fb.doc(window._fb.db, 'settings', 'admin'));
      if (snap.exists()) {
        const d = snap.data();
        if (d.shopOpen      !== undefined) adminSettings.shopOpen      = d.shopOpen;
        if (d.workDays      !== undefined) adminSettings.workDays      = d.workDays;
        if (d.workHours     !== undefined) adminSettings.workHours     = d.workHours;
        if (d.takenSlots    !== undefined) adminSettings.takenSlots    = d.takenSlots;
        if (d.blockedDates  !== undefined) adminSettings.blockedDates  = d.blockedDates;
        if (d.duracaoPadrao !== undefined) adminSettings.duracaoPadrao = d.duracaoPadrao;
        if (d.services      !== undefined) adminSettings.services      = d.services;
        if (d.barbeiros     !== undefined) adminSettings.barbeiros     = d.barbeiros;
        if (d.politicaReembolso !== undefined) adminSettings.politicaReembolso = d.politicaReembolso;

        // Migração automática de slots antigos (45min)
        if (d.slots !== undefined) {
          const antigos45 = ['08:45','09:30','10:15','13:45','14:30','15:15','16:45','17:30'];
          const temAntigo = d.slots.some(s => antigos45.includes(s));
          adminSettings.slots = temAntigo
            ? ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']
            : d.slots;
          if (temAntigo) { adminSettings.takenSlots = []; adminSettings.duracaoPadrao = 60; }
        }
      }
    } catch (e) { console.warn('Sem Firestore, usando dados padrão.', e); }

    // Carrega dias bloqueados dos barbeiros (para o agendamento público)
    try {
      const { collection, getDocs, db } = window._fb;
      const snap = await getDocs(collection(db, 'dias_bloqueados'));
      adminSettings.diasBloqueadosBarbeiro = [];
      snap.forEach(d => adminSettings.diasBloqueadosBarbeiro.push({ id: d.id, ...d.data() }));
    } catch (_) { /* collection pode ainda não existir */ }

    // Monitora autenticação
    window._fb.onAuthStateChanged(window._fb.auth, async (user) => {
      if (user) {
        // Usuário anônimo — apenas autenticação de infraestrutura, não exibe como logado
        if (user.isAnonymous) return;

        // Verifica primeiro se este Firebase user corresponde a um barbeiro cadastrado
        // (barbeiros fazem signIn com email/senha no Firebase, mas não ficam em users/{uid})
        const settingsSnap = await window._fb.getDoc(window._fb.doc(window._fb.db, 'settings', 'admin')).catch(() => null);
        const barbeiros = settingsSnap?.exists() ? (settingsSnap.data().barbeiros || []) : [];
        const barbMatch = barbeiros.find(b => b.email === user.email && b.ativo !== false);

        if (barbMatch) {
          // É um barbeiro — monta fbUser com isBarbeiro e não busca em users/
          window.fbUser = {
            uid:        'barb_' + barbMatch.id,
            email:      user.email,
            name:       barbMatch.nome,
            isBarbeiro: true,
            barbeiroId: barbMatch.id,
          };
          window._barbeiroPainel = barbMatch;
          try { localStorage.setItem('bbdavi_barbeiro', JSON.stringify(window.fbUser)); } catch (_) {}
          updateNavUserFb();
          return;
        }

        // Usuário normal (cliente ou admin)
        const snap = await window._fb.getDoc(window._fb.doc(window._fb.db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : {};
        window.fbUser = { uid: user.uid, email: user.email, name: data.name || user.displayName || 'Usuário', phone: data.phone || '', isAdmin: data.isAdmin || false };
        updateNavUserFb();
        if (data.isAdmin) showAdminNavBtn();
        const { fillLoggedFields } = await import('./login.js');
        fillLoggedFields();
      } else {
        // Antes de limpar, verifica se há sessão de barbeiro salva
        try {
          const cached = localStorage.getItem('bbdavi_barbeiro');
          if (cached) {
            const barbUser = JSON.parse(cached);
            if (barbUser?.isBarbeiro) {
              // Mantém a sessão do barbeiro intacta — não limpa
              window.fbUser = barbUser;
              updateNavUserFb();
              return;
            }
          }
        } catch (_) {}
        window.fbUser = null;
        updateNavUserFb();
        const { clearLoggedFields } = await import('./login.js');
        clearLoggedFields();
      }
    });
  }

  // Normaliza serviços
  adminSettings.services = adminSettings.services.map(s => ({
    ...s,
    time: '1h',
    hidden: s.hidden || false,
    name: s.name || s.nome || 'Serviço',
    desc: s.desc || s.descricao || '',
    price: parseFloat(s.price || s.preco) || 0,
    icon: s.icon || s.icone || '✂️',
    bg: s.bg || 'gi-corte',
    id: s.id || 'svc_' + Math.random().toString(36).slice(2),
  }));

  renderGallery();

  // Restaura carrinho e estado do agendamento salvos antes do F5
  const restored = restoreCartFromStorage(adminSettings);

  updateCartUI();
  updateHeroStatus();

  const { renderBarbeiroGrid, goBookStep, renderSlots } = await import('./agendamento.js');
  renderBarbeiroGrid();

  // Se havia sessão salva, navega direto para o step correto
  if (restored && booking.step > 0) {
    goBookStep(booking.step);
    if (booking.date) renderSlots();
  }

  // Inicia sincronização em tempo real — todos os usuários recebem
  // atualizações do admin/barbeiro automaticamente, sem precisar de F5
  startRealtimeSync();
}

/* ── Expõe funções globais ── */
window.addToCart    = addToCart;
window.removeFromCart = removeFromCart;
window.toggleCart   = toggleCart;

/* ══════════════════════════════════════════
   ANIMAÇÕES DE SCROLL
══════════════════════════════════════════ */

/* Observer compartilhado */
let _scrollObs = null;

function getScrollObserver() {
  if (_scrollObs) return _scrollObs;
  _scrollObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('visible');
      // Contador animado nos stats
      if (el.classList.contains('stat-n')) animateStatCounter(el);
      _scrollObs.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
  return _scrollObs;
}

/* Conta o número animadamente de 0 até o valor alvo */
function animateStatCounter(el) {
  const original = el.textContent.trim();
  // Extrai número e sufixo (ex: "300+" → 300, "+")
  const match = original.match(/^(\d+)(.*)/);
  if (!match) return;
  const target  = parseInt(match[1], 10);
  const suffix  = match[2] || '';
  const steps   = 40;
  const delay   = 18; // ms por frame
  let current   = 0;
  const inc     = Math.max(1, Math.ceil(target / steps));

  const tick = setInterval(() => {
    current = Math.min(current + inc, target);
    el.textContent = current + suffix;
    if (current >= target) {
      clearInterval(tick);
      el.classList.add('glow-done'); // dispara glow vermelho
    }
  }, delay);
}

/* Observa os cards da galeria (chamado após renderGallery) */
function observeGalleryCards() {
  const obs = getScrollObserver();
  document.querySelectorAll('#galleryGrid .gallery-card:not([data-obs])').forEach((card, i) => {
    card.setAttribute('data-obs', '1');
    card.classList.add('anim-reveal', `anim-d${(i % 8) + 1}`);
    obs.observe(card);
  });
}

/* Registra os elementos estáticos da página */
function initScrollAnimations() {
  const obs = getScrollObserver();

  // Títulos de seção — slide da esquerda
  document.querySelectorAll('.sec-title').forEach(el => {
    el.classList.add('anim-left');
    obs.observe(el);
  });

  // Stats do hero — reveal escalonado
  document.querySelectorAll('.hero-stats > div').forEach((el, i) => {
    el.classList.add('anim-reveal', `anim-d${i + 1}`);
    obs.observe(el);
    // Também observa o número interno para a contagem
    const num = el.querySelector('.stat-n');
    if (num) obs.observe(num);
  });

  // Bloco do mapa e info
  document.querySelectorAll('.mapa-container, .mapa-info').forEach((el, i) => {
    el.classList.add('anim-reveal', `anim-d${i + 1}`);
    obs.observe(el);
  });

  // Botões de ação do hero
  document.querySelectorAll('.hero-btns > *').forEach((el, i) => {
    el.classList.add('anim-reveal', `anim-d${i + 1}`);
    obs.observe(el);
  });
}

/* Sobrescreve renderGallery para aplicar animações nos cards */
const _origRenderGallery = window.renderGallery;
const _origInit = window.initSite;

// Patch: após renderGallery, observa os novos cards
const _patchedRenderGallery = function() {
  // renderGallery é chamada internamente — fazemos patch via MutationObserver
};

// Inicia animações quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initScrollAnimations();
    // Aguarda renderGallery popular o grid e então observa os cards
    const gridEl = document.getElementById('galleryGrid');
    if (gridEl) {
      const mut = new MutationObserver(() => observeGalleryCards());
      mut.observe(gridEl, { childList: true });
    }
  });
} else {
  initScrollAnimations();
  const gridEl = document.getElementById('galleryGrid');
  if (gridEl) {
    const mut = new MutationObserver(() => observeGalleryCards());
    mut.observe(gridEl, { childList: true });
  }
}

/* ══════════════════════════════════════════
   PARTÍCULAS NO HERO
══════════════════════════════════════════ */
(function initParticles(){
  const canvas = document.getElementById('heroParticles');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize(){
    const hero = canvas.parentElement;
    W = canvas.width  = hero.offsetWidth;
    H = canvas.height = hero.offsetHeight;
  }

  function mkParticle(){
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.5 - 0.15,
      alpha: Math.random() * 0.5 + 0.1,
      life: 1,
      decay: Math.random() * 0.003 + 0.001
    };
  }

  function init(){
    resize();
    particles = Array.from({length: 90}, mkParticle);
  }

  function draw(){
    ctx.clearRect(0, 0, W, H);
    particles.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      if(p.life <= 0 || p.y < -5) particles[i] = mkParticle();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      // alterna entre vermelho e branco
      const isRed = i % 3 === 0;
      ctx.fillStyle = isRed
        ? `rgba(224,32,32,${p.alpha * p.life})`
        : `rgba(255,255,255,${p.alpha * p.life * 0.5})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); });
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => { init(); draw(); });
  } else { init(); draw(); }
})();

/* ══════════════════════════════════════════
   ANIMAÇÕES DO MAPA
══════════════════════════════════════════ */
(function initMapAnims(){
  function setup(){
    const mapaC = document.querySelector('.mapa-container');
    const mapaI = document.querySelector('.mapa-info');
    if(mapaC){ mapaC.classList.add('anim-map-enter'); getScrollObserver().observe(mapaC); }
    if(mapaI){ mapaI.classList.add('anim-map-enter'); getScrollObserver().observe(mapaI); }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();

/* ══════════════════════════════════════════
   RIPPLE NOS BOTÕES DE AGENDAMENTO
══════════════════════════════════════════ */
(function initRipple(){
  function addRipple(e){
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const span = document.createElement('span');
    span.className = 'ripple-fx';
    span.style.left = (e.clientX - rect.left) + 'px';
    span.style.top  = (e.clientY - rect.top)  + 'px';
    btn.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
  }

  function attachRipple(){
    document.querySelectorAll('.cart-agendar-btn, .gale-agendar-btn').forEach(btn => {
      if(!btn.dataset.ripple){
        btn.dataset.ripple = '1';
        btn.addEventListener('click', addRipple);
      }
    });
  }

  // Re-attach quando o carrinho/modal atualizar
  const body = document.body;
  const mo = new MutationObserver(attachRipple);
  mo.observe(body, { childList: true, subtree: true });

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachRipple);
  else attachRipple();

  // Pulso no botão quando há itens no carrinho
  function updateAgendarPulse(){
    const btn = document.querySelector('.cart-agendar-btn');
    if(!btn) return;
    const count = parseInt(document.querySelector('.cart-badge')?.textContent || '0');
    btn.classList.toggle('has-items', count > 0);
  }
  setInterval(updateAgendarPulse, 800);
})();

/* ══════════════════════════════════════════
   GALERIA: ZOOM REVEAL NOS CARDS
══════════════════════════════════════════ */
(function patchGalleryAnim(){
  const obs = typeof getScrollObserver === 'function' ? getScrollObserver() : null;
  if(!obs) return;
  const grid = document.getElementById('galleryGrid');
  if(!grid) return;
  const mo = new MutationObserver(() => {
    grid.querySelectorAll('.gallery-card:not([data-ganim])').forEach((card, i) => {
      card.dataset.ganim = '1';
      card.classList.add('anim-gallery', `anim-d${(i % 8) + 1}`);
      obs.observe(card);
    });
  });
  mo.observe(grid, { childList: true });
})();

/* ══════════════════════════════════════════
   FOOTER ANIMADO
══════════════════════════════════════════ */
(function initFooterAnim(){
  function setup(){
    const footer = document.querySelector('footer');
    if(!footer) return;
    const fo = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if(e.isIntersecting){ footer.classList.add('footer-visible'); fo.disconnect(); }
      });
    }, { threshold: 0.15 });
    fo.observe(footer);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
