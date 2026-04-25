/* ══════════════════════════════════════════
   REALTIME.JS — Sincronização em tempo real via Firestore onSnapshot
   Barbearia do Davi
   
   Como funciona:
   - Fica ouvindo mudanças no Firestore (settings/admin e dias_bloqueados)
   - Quando admin ou barbeiro salva algo, TODOS os outros usuários
     recebem a atualização automaticamente, sem precisar de F5
   - O usuário que acabou de salvar NÃO recebe o toast nem re-render
     desnecessário (usa a flag _justSaved)
══════════════════════════════════════════ */

import { adminSettings } from './global.js';

/* ── Estado interno ── */
let _unsubSettings  = null;   // função para cancelar listener de settings
let _unsubDiasBloq  = null;   // função para cancelar listener de dias bloqueados
let _justSaved      = false;  // true por 5s após o usuário atual salvar algo
let _syncStarted    = false;  // evita iniciar duas vezes

/* ── Marca que o usuário atual acabou de salvar (chame antes do setDoc) ── */
export function markJustSaved() {
  _justSaved = true;
  clearTimeout(window._bbJustSavedTimer);
  window._bbJustSavedTimer = setTimeout(() => { _justSaved = false; }, 5000);
}

/* ── Aplica dados do snapshot ao adminSettings ── */
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
  // Garante time='1h' em todos os serviços
  if (adminSettings.services) {
    adminSettings.services = adminSettings.services.map(s => ({ ...s, time: '1h' }));
  }
}

/* ── Re-renderiza a página atual com os novos dados ── */
async function _reRenderPagina() {
  // Atualiza status hero (aberto/fechado) — existe em todas as páginas
  try {
    const { updateHeroStatus } = await import('./global.js');
    updateHeroStatus();
  } catch (_) {}

  // Galeria de serviços (index.html)
  try {
    const { renderGallery, updateCartUI } = await import('./index.js');
    if (renderGallery) renderGallery();
    if (updateCartUI)  updateCartUI();
  } catch (_) {}

  // Grid de barbeiros no agendamento
  try {
    const { renderBarbeiroGrid } = await import('./agendamento.js');
    if (renderBarbeiroGrid) renderBarbeiroGrid();
  } catch (_) {}

  // Painel admin (re-renderiza dashboard se estiver aberto)
  try {
    const { loadAdminSettings } = await import('./admin.js');
    // Só re-carrega se o painel admin estiver visível na tela
    if (document.getElementById('adminSection')?.offsetParent !== null) {
      loadAdminSettings();
    }
  } catch (_) {}
}

/* ── Inicia a sincronização em tempo real ── */
export async function startRealtimeSync() {
  if (_syncStarted) return;

  // Aguarda o Firebase estar pronto
  let tentativas = 0;
  while (!window._fb?.onSnapshot && tentativas < 50) {
    await new Promise(r => setTimeout(r, 100));
    tentativas++;
  }

  if (!window._fb?.onSnapshot) {
    console.warn('[realtime] onSnapshot não disponível no window._fb. Sync em tempo real desativado.');
    return;
  }

  _syncStarted = true;
  const { onSnapshot, doc, collection, db } = window._fb;

  /* ── Listener 1: settings/admin ── */
  try {
    _unsubSettings = onSnapshot(
      doc(db, 'settings', 'admin'),
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.exists()) return;

        // hasPendingWrites=true → mudança local (este usuário acabou de escrever)
        // Ignoramos completamente para não duplicar trabalho
        if (snap.metadata.hasPendingWrites) return;

        // Atualiza os dados em memória
        _aplicarDados(snap.data());

        // Se foi o próprio usuário que salvou (confirmação do servidor), atualiza
        // dados silenciosamente mas não mostra toast nem re-renderiza
        if (_justSaved) return;

        // Outro usuário salvou → re-renderiza e avisa sutilmente
        _reRenderPagina();
        _mostrarBanner();
      },
      (err) => {
        console.warn('[realtime] Erro no listener settings/admin:', err.message);
      }
    );
  } catch (e) {
    console.warn('[realtime] Não foi possível iniciar listener settings/admin:', e);
  }

  /* ── Listener 2: dias_bloqueados (coleção do barbeiro) ── */
  try {
    _unsubDiasBloq = onSnapshot(
      collection(db, 'dias_bloqueados'),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites) return;

        adminSettings.diasBloqueadosBarbeiro = [];
        snap.forEach(d => {
          adminSettings.diasBloqueadosBarbeiro.push({ id: d.id, ...d.data() });
        });

        if (_justSaved) return;

        // Re-renderiza calendário de agendamento se estiver visível
        try {
          import('./agendamento.js').then(m => {
            if (m.renderBarbeiroGrid) m.renderBarbeiroGrid();
          });
        } catch (_) {}
      },
      (err) => {
        console.warn('[realtime] Erro no listener dias_bloqueados:', err.message);
      }
    );
  } catch (e) {
    console.warn('[realtime] Não foi possível iniciar listener dias_bloqueados:', e);
  }
}

/* ── Para a sincronização (útil ao fazer logout) ── */
export function stopRealtimeSync() {
  if (_unsubSettings) { _unsubSettings(); _unsubSettings = null; }
  if (_unsubDiasBloq) { _unsubDiasBloq(); _unsubDiasBloq = null; }
  _syncStarted = false;
}

/* ── Banner sutil de atualização (aparece no topo, some em 3s) ── */
let _bannerTimer = null;
function _mostrarBanner() {
  // Não mostra banner dentro do painel admin/barbeiro
  if (window.location.pathname.includes('painel')) return;

  let banner = document.getElementById('bb-realtime-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'bb-realtime-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0;
      background: linear-gradient(90deg, #1a1a1a, #2a2a2a);
      color: #c8a96e;
      text-align: center;
      font-size: 0.78rem;
      font-family: 'Inter', sans-serif;
      letter-spacing: 0.04em;
      padding: 7px 1rem;
      z-index: 99999;
      transform: translateY(-100%);
      transition: transform 0.3s ease;
      border-bottom: 1px solid #c8a96e33;
      pointer-events: none;
    `;
    document.body.appendChild(banner);
  }

  banner.textContent = '✦ Conteúdo atualizado pelo administrador';
  banner.style.transform = 'translateY(0)';

  clearTimeout(_bannerTimer);
  _bannerTimer = setTimeout(() => {
    banner.style.transform = 'translateY(-100%)';
  }, 3000);
}
