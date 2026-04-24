/* ══════════════════════════════════════════
   INDEX.JS — Galeria de serviços, carrinho, init
   Barbearia do Davi
══════════════════════════════════════════ */

import {
  adminSettings, cart, addToCartArr, removeFromCartArr,
  showToast, updateHeroStatus, updateNavUserFb, showAdminNavBtn
} from './global.js';

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
  updateCartUI();
  renderGallery();
  showToast('✓ ' + svc.name + ' adicionado!');
}

/* ── Remove do carrinho ── */
export function removeFromCart(id, e) {
  e && e.stopPropagation();
  removeFromCartArr(id);
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

    // Monitora autenticação
    window._fb.onAuthStateChanged(window._fb.auth, async (user) => {
      if (user) {
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
  updateCartUI();
  updateHeroStatus();

  const { renderBarbeiroGrid } = await import('./agendamento.js');
  renderBarbeiroGrid();
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
