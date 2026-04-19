/* ══════════════════════════════════════════
   JS/NOTIFICACOES.JS
   Gerencia permissões, tokens FCM e escuta
   em tempo real por novos agendamentos.
   Barbearia do Davi
══════════════════════════════════════════ */

/* ─── VAPID Key pública do projeto Firebase ───
   Gere em: Firebase Console → Project Settings
   → Cloud Messaging → Web Push certificates
   Cole aqui a "Key pair" gerada.            */
const VAPID_KEY = 'SUA_VAPID_KEY_AQUI';

/* ─── Estado ─────────────────────────── */
let _messaging    = null;
let _unsubSnapshot = null;  // para cancelar listener ao deslogar
let _lastCheck    = null;   // ISO timestamp — ignora docs mais antigos

/* ══════════════════════════════════════════
   INICIALIZAR (chame após Firebase estar pronto)
══════════════════════════════════════════ */
export async function iniciarNotificacoes(opcoes = {}) {
  /*
    opcoes = {
      role: 'admin' | 'barbeiro',
      barbeiroId: 'barb_xxx',   // só para barbeiro
    }
  */
  if (!('Notification' in window)) return;
  if (!window._fb) return;

  // Registra o Service Worker
  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  } catch (e) {
    console.warn('SW não registrado:', e);
  }

  // Pede permissão se ainda não foi dada
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    console.log('Notificações não autorizadas.');
    return;
  }

  // Salva token FCM no Firestore para uso futuro (cloud functions, etc.)
  await _salvarToken(opcoes.role, opcoes.barbeiroId);

  // Escuta em tempo real via onSnapshot (funciona com aba aberta)
  _lastCheck = new Date().toISOString();
  _escutarNovosAgendamentos(opcoes);
}

/* ══════════════════════════════════════════
   SALVAR TOKEN FCM NO FIRESTORE
══════════════════════════════════════════ */
async function _salvarToken(role, barbeiroId) {
  if (!window._fb) return;
  try {
    const { getMessaging, getToken } = await import(
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js'
    );
    if (!_messaging) _messaging = getMessaging();
    const token = await getToken(_messaging, { vapidKey: VAPID_KEY });
    if (!token) return;

    const { setDoc, doc, db } = window._fb;
    const docId = barbeiroId || role || 'admin';
    await setDoc(doc(db, 'notificacoes_tokens', docId), {
      token,
      role:       role || 'admin',
      barbeiroId: barbeiroId || null,
      atualizadoEm: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    // VAPID key não configurada ainda — notificações em foreground ainda funcionam
    console.warn('FCM token não salvo (VAPID key não configurada):', e.message);
  }
}

/* ══════════════════════════════════════════
   ESCUTAR NOVOS AGENDAMENTOS (foreground)
══════════════════════════════════════════ */
function _escutarNovosAgendamentos({ role, barbeiroId }) {
  if (_unsubSnapshot) _unsubSnapshot(); // cancela listener anterior

  const { collection, query, where, onSnapshot, db } = window._fb;

  let q;
  if (role === 'barbeiro' && barbeiroId) {
    // Barbeiro só recebe notificações dos próprios clientes
    q = query(
      collection(db, 'agendamentos'),
      where('barbeiroId', '==', barbeiroId),
      where('status', '==', 'confirmado')
    );
  } else {
    // Admin recebe todos
    q = query(
      collection(db, 'agendamentos'),
      where('status', '==', 'confirmado')
    );
  }

  _unsubSnapshot = onSnapshot(q, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type !== 'added') return;
      const ag = change.doc.data();

      // Ignora documentos já existentes antes de iniciar o listener
      if (ag.criadoEm && ag.criadoEm <= _lastCheck) return;

      _dispararNotificacao(ag, role);
    });
  }, err => {
    console.warn('onSnapshot erro:', err);
  });
}

/* ══════════════════════════════════════════
   DISPARAR NOTIFICAÇÃO NATIVA
══════════════════════════════════════════ */
function _dispararNotificacao(ag, role) {
  const titulo = '✂️ Novo agendamento!';
  const corpo  = role === 'barbeiro'
    ? `${ag.cliente} — ${ag.horario} · ${ag.data}\n${ag.servicos}`
    : `${ag.cliente} com ${ag.barbeiro} — ${ag.horario} · ${ag.data}`;

  // Tenta via Service Worker (aparece mesmo com aba minimizada)
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(titulo, {
        body:    corpo,
        icon:    '/icon-192.png',
        badge:   '/icon-192.png',
        vibrate: [200, 100, 200],
        tag:     'agendamento-' + ag.pedidoId,
        data:    { url: role === 'barbeiro' ? '/pages/painel.html' : '/' },
        actions: [{ action: 'ver', title: '👀 Ver' }],
      });
    });
  } else {
    // Fallback: notificação simples sem SW
    new Notification(titulo, {
      body: corpo,
      icon: '/icon-192.png',
    });
  }

  // Também mostra toast in-app se disponível
  if (typeof window.showToast === 'function') {
    window.showToast(`🔔 Novo: ${ag.cliente} — ${ag.horario}`);
  }
}

/* ══════════════════════════════════════════
   CANCELAR LISTENER (ao fazer logout)
══════════════════════════════════════════ */
export function pararNotificacoes() {
  if (_unsubSnapshot) {
    _unsubSnapshot();
    _unsubSnapshot = null;
  }
}

/* ══════════════════════════════════════════
   BOTÃO DE ATIVAR NOTIFICAÇÕES (UI helper)
   Mostra um banner discreto pedindo permissão
══════════════════════════════════════════ */
export function mostrarBannerNotificacoes(opcoes = {}) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    iniciarNotificacoes(opcoes);
    return;
  }
  if (Notification.permission === 'denied') return;

  // Cria o banner
  const banner = document.createElement('div');
  banner.id = 'notif-banner';
  banner.innerHTML = `
    <span>🔔 Ativar notificações de novos agendamentos?</span>
    <div style="display:flex;gap:0.5rem;margin-top:0.5rem">
      <button id="notifBannerSim">✓ Ativar</button>
      <button id="notifBannerNao">✕ Agora não</button>
    </div>`;
  banner.style.cssText = `
    position:fixed;bottom:5rem;right:1.2rem;z-index:9000;
    background:#1a1a1a;border:1px solid rgba(224,32,32,0.4);color:#f5f0e8;
    padding:0.9rem 1.1rem;border-radius:4px;font-size:0.78rem;
    font-family:'Inter',sans-serif;max-width:280px;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);
    animation:slideUp 0.3s ease;`;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    #notif-banner button{background:transparent;border:1px solid rgba(224,32,32,0.5);color:#f5f0e8;
      padding:0.3rem 0.8rem;border-radius:2px;cursor:pointer;font-size:0.72rem;font-family:'Inter',sans-serif}
    #notifBannerSim{background:rgba(224,32,32,0.15);border-color:#e02020;color:#fff}
    #notifBannerSim:hover{background:#e02020}
    #notifBannerNao:hover{border-color:#888;color:#888}`;
  document.head.appendChild(style);
  document.body.appendChild(banner);

  document.getElementById('notifBannerSim').onclick = () => {
    banner.remove();
    iniciarNotificacoes(opcoes);
  };
  document.getElementById('notifBannerNao').onclick = () => {
    banner.remove();
    localStorage.setItem('notif_recusada', '1');
  };
}
