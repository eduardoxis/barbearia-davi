/* ══════════════════════════════════════════
   REALTIME.JS — Sincronização em tempo real via Firestore onSnapshot
   Barbearia do Davi

   Como funciona:
   - Fica ouvindo mudanças no Firestore (settings/admin e dias_bloqueados)
   - Quando admin ou barbeiro salva algo, TODOS os outros usuários
     recebem a atualização automaticamente, sem precisar de F5
   - O usuário que acabou de salvar NÃO recebe o banner nem re-render
     desnecessário (usa a flag _justSaved)
══════════════════════════════════════════ */

import { adminSettings } from './global.js';

/* ── Estado interno ── */
let _unsubSettings      = null;
let _unsubDiasBloq      = null;
let _justSaved          = false;
let _syncStarted        = false;
let _primeiroSettings   = true;  // ignora o snapshot inicial (dados já carregados)
let _primeiroDiasBloq   = true;  // ignora o snapshot inicial da coleção

/* ── Marca que o usuário atual acabou de salvar ── */
export function markJustSaved() {
  _justSaved = true;
  clearTimeout(window._bbJustSavedTimer);
  window._bbJustSavedTimer = setTimeout(() => { _justSaved = false; }, 5000);
}

/* ── Aplica dados do Firestore ao adminSettings em memória ── */
function _aplicarDados(d) {
  const keys = [
    'shopOpen', 'workDays', 'workHours', 'slots', 'takenSlots',
    'blockedDates', 'services', 'duracaoPadrao', 'politicaReembolso', 'barbeiros'
  ];
  keys.forEach(k => { if (d[k] !== undefined) adminSettings[k] = d[k]; });

  // Migração de slots antigos (45min)
  if (d.slots !== undefined) {
    const antigos45 = ['08:45','09:30','10:15','13:45','14:30','15:15','16:45','17:30'];
    if (d.slots.some(s => antigos45.includes(s))) {
      adminSettings.slots = ['08:00','09:00','10:00','11:00','12:00','13:00',
                             '14:00','15:00','16:00','17:00','18:00'];
      adminSettings.duracaoPadrao = 60;
    }
  }
  if (adminSettings.services) {
    adminSettings.services = adminSettings.services.map(s => ({ ...s, time: '1h' }));
  }
}

/* ── Re-renderiza todos os componentes afetados ── */
async function _reRenderPagina() {
  // 1. Status hero (aberto/fechado) — presente em todas as páginas
  try {
    const { updateHeroStatus } = await import('./global.js');
    if (updateHeroStatus) updateHeroStatus();
  } catch (_) {}

  // 2. Galeria de serviços
  try {
    const { renderGallery, updateCartUI } = await import('./index.js');
    if (renderGallery) renderGallery();
    if (updateCartUI)  updateCartUI();
  } catch (_) {}

  // 3. Agendamento: grid de barbeiros + calendário + slots (se visíveis)
  try {
    const ag = await import('./agendamento.js');

    if (ag.renderBarbeiroGrid) ag.renderBarbeiroGrid();

    // Calendário — re-renderiza se estiver visível na tela
    const calGrid = document.getElementById('calGrid');
    if (calGrid && calGrid.offsetParent !== null && ag.renderCalendar) {
      ag.renderCalendar();
    }

    // Slots de horário — re-renderiza se visíveis
    const slotsGrid = document.getElementById('slotsGrid');
    if (slotsGrid && slotsGrid.offsetParent !== null && ag.renderSlots) {
      ag.renderSlots();
    }
  } catch (_) {}
}

/* ── Inicia a sincronização em tempo real ── */
export async function startRealtimeSync() {
  if (_syncStarted) return;

  // Aguarda o Firebase estar pronto (max 5 segundos)
  let tentativas = 0;
  while (!window._fb?.onSnapshot && tentativas < 50) {
    await new Promise(r => setTimeout(r, 100));
    tentativas++;
  }

  if (!window._fb?.onSnapshot) {
    console.warn('[realtime] onSnapshot indisponível. Sync desativado.');
    return;
  }

  _syncStarted = true;
  const { onSnapshot, doc, collection, db } = window._fb;

  /* ── Listener 1: settings/admin ── */
  try {
    _unsubSettings = onSnapshot(
      doc(db, 'settings', 'admin'),
      (snap) => {
        if (!snap.exists()) return;

        // Primeiro disparo = carga inicial da página (dados já estão em memória)
        if (_primeiroSettings) { _primeiroSettings = false; return; }

        // Atualiza adminSettings com os dados vindos do servidor
        _aplicarDados(snap.data());

        // Se foi ESTE usuário quem salvou, apenas atualiza dados silenciosamente
        if (_justSaved) return;

        // Outro usuário (admin/barbeiro) salvou → atualiza a UI e avisa
        _reRenderPagina();
        _mostrarBanner();
      },
      (err) => console.warn('[realtime] Erro settings/admin:', err.message)
    );
  } catch (e) {
    console.warn('[realtime] Falha ao criar listener settings/admin:', e);
  }

  /* ── Listener 2: dias_bloqueados ── */
  try {
    _unsubDiasBloq = onSnapshot(
      collection(db, 'dias_bloqueados'),
      (snap) => {
        // Primeiro disparo = carga inicial
        if (_primeiroDiasBloq) { _primeiroDiasBloq = false; return; }

        // Atualiza lista de dias bloqueados por barbeiro
        adminSettings.diasBloqueadosBarbeiro = [];
        snap.forEach(d => {
          adminSettings.diasBloqueadosBarbeiro.push({ id: d.id, ...d.data() });
        });

        if (_justSaved) return;

        // Re-renderiza calendário e grid de barbeiros
        import('./agendamento.js').then(ag => {
          if (ag.renderBarbeiroGrid) ag.renderBarbeiroGrid();
          const calGrid = document.getElementById('calGrid');
          if (calGrid && calGrid.offsetParent !== null && ag.renderCalendar) {
            ag.renderCalendar();
          }
        }).catch(() => {});

        _mostrarBanner();
      },
      (err) => console.warn('[realtime] Erro dias_bloqueados:', err.message)
    );
  } catch (e) {
    console.warn('[realtime] Falha ao criar listener dias_bloqueados:', e);
  }
}

/* ── Para a sincronização (útil ao fazer logout) ── */
export function stopRealtimeSync() {
  if (_unsubSettings) { _unsubSettings(); _unsubSettings = null; }
  if (_unsubDiasBloq) { _unsubDiasBloq(); _unsubDiasBloq = null; }
  _syncStarted = false;
  _primeiroSettings = true;
  _primeiroDiasBloq = true;
}

/* ── Banner sutil no topo da página ── */
let _bannerTimer = null;
function _mostrarBanner() {
  if (window.location.pathname.includes('painel')) return;

  let banner = document.getElementById('bb-realtime-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'bb-realtime-banner';
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0',
      'background:linear-gradient(90deg,#1a1a1a,#2a2a2a)',
      'color:#c8a96e',
      'text-align:center',
      'font-size:0.78rem',
      'font-family:Inter,sans-serif',
      'letter-spacing:0.04em',
      'padding:7px 1rem',
      'z-index:99999',
      'transform:translateY(-100%)',
      'transition:transform 0.3s ease',
      'border-bottom:1px solid #c8a96e33',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(banner);
  }

  banner.textContent = '✦ Conteúdo atualizado pelo administrador';
  banner.style.transform = 'translateY(0)';
  clearTimeout(_bannerTimer);
  _bannerTimer = setTimeout(() => {
    banner.style.transform = 'translateY(-100%)';
  }, 3000);
}
