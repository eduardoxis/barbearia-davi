/* ══════════════════════════════════════════
   BOTTOM-NAV.JS
   Menu inferior nativo — Barbearia do Davi
   Constrói o nav diretamente via JS, sem
   dependência de fetch para funcionar no Vercel
══════════════════════════════════════════ */
(function () {
  'use strict';

  /* Definição dos itens do menu */
  var ITEMS = [
    {
      page: 'index',
      label: 'Início',
      href: '#',
      onclick: "window.scrollTo({top:0,behavior:'smooth'});return false;",
      svg: '<svg viewBox="0 0 24 24"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>'
    },
    {
      page: 'servicos',
      label: 'Serviços',
      href: '#servicos',
      onclick: null,
      svg: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>'
    },
    {
      page: 'agendamento',
      label: 'Agendar',
      href: '#agendar',
      onclick: null,
      svg: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
    },
    {
      page: 'perfil',
      label: 'Perfil',
      href: '#',
      onclick: "if(window.openUserModal){window.openUserModal();}return false;",
      svg: '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
    }
  ];

  /* Constrói e injeta o nav no DOM */
  function build() {
    var existing = document.getElementById('bottomNav');
    if (existing) existing.parentNode.removeChild(existing);

    var nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.id = 'bottomNav';

    ITEMS.forEach(function (item, index) {
      var a = document.createElement('a');
      a.href = item.href;
      a.className = 'bn-item' + (index === 0 ? ' active' : '');
      a.dataset.page = item.page;
      if (item.onclick) a.setAttribute('onclick', item.onclick);
      a.innerHTML =
        '<span class="bn-icon">' + item.svg + '</span>' +
        '<span class="bn-label">' + item.label + '</span>';
      nav.appendChild(a);
    });

    document.body.appendChild(nav);
    init();
  }

  /* Inicializa comportamentos */
  function init() {
    markActive();
    bindClicks();
    observeSections();
    window.addEventListener('hashchange', markActive);
  }

  /* Define item ativo com base na URL atual */
  function markActive() {
    var hash = (window.location.hash || '').toLowerCase();
    var path = window.location.pathname.toLowerCase();
    var page = 'index';

    if      (hash === '#agendar'  || path.includes('agendamento')) page = 'agendamento';
    else if (hash === '#servicos' || path.includes('servico'))     page = 'servicos';
    else if (hash === '#perfil'   || path.includes('perfil'))      page = 'perfil';

    setActive(page);
  }

  function setActive(page) {
    document.querySelectorAll('.bn-item').forEach(function (el) {
      el.classList.toggle('active', el.dataset.page === page);
    });
  }

  /* Atualiza ativo ao clicar */
  function bindClicks() {
    document.querySelectorAll('.bn-item').forEach(function (el) {
      el.addEventListener('click', function () {
        document.querySelectorAll('.bn-item').forEach(function (i) {
          i.classList.remove('active');
        });
        this.classList.add('active');
      });
    });
  }

  /* Atualiza ativo ao fazer scroll entre seções */
  function observeSections() {
    if (!('IntersectionObserver' in window)) return;

    var sectionMap = [
      { id: 'servicos', page: 'servicos'    },
      { id: 'agendar',  page: 'agendamento' }
    ];

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var match = sectionMap.find(function (s) { return s.id === entry.target.id; });
        if (match) setActive(match.page);
      });
    }, { threshold: 0.4 });

    sectionMap.forEach(function (s) {
      var el = document.getElementById(s.id);
      if (el) io.observe(el);
    });

    var hero = document.querySelector('.hero');
    if (hero) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) setActive('index');
      }, { threshold: 0.3 }).observe(hero);
    }
  }

  /* Aguarda DOM pronto antes de construir */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

})();
