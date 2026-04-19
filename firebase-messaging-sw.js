/* ══════════════════════════════════════════
   FIREBASE MESSAGING SERVICE WORKER
   Barbearia do Davi — Push Notifications
══════════════════════════════════════════ */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyDK0bmVX9tTMCLw7fSDBrW-E8D3SK63DaY",
  authDomain:        "barbearia-davi.firebaseapp.com",
  projectId:         "barbearia-davi",
  storageBucket:     "barbearia-davi.firebasestorage.app",
  messagingSenderId: "327274722401",
  appId:             "1:327274722401:web:f2ddac69ff5d4161716620"
});

const messaging = firebase.messaging();

/* Notificação recebida com a aba em background */
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || '✂️ Barbearia do Davi', {
    body:    body || 'Novo agendamento recebido!',
    icon:    icon || '/icon-192.png',
    badge:   '/icon-192.png',
    vibrate: [200, 100, 200],
    data:    payload.data || {},
    actions: [
      { action: 'ver', title: '👀 Ver agendamento' },
    ],
  });
});

/* Clique na notificação → abre o painel */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.action === 'ver'
    ? (event.notification.data?.url || '/pages/painel.html')
    : '/';
  event.waitUntil(clients.openWindow(url));
});
