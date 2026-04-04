/* ══════════════════════════════════════════════════════════════
   BACKEND/DATABASE/FIREBASE-ADMIN.JS
   Inicializa o Firebase Admin SDK (singleton)
   Usado pelos serviços de backend (Cron, etc.)
══════════════════════════════════════════════════════════════ */

import { initializeApp, getApps, cert } from 'firebase-admin/app';

let _app = null;

export function initFirebaseAdmin() {
  if (_app) return _app;

  // Aceita credenciais como JSON string ou como variáveis individuais
  const credencial = process.env.FIREBASE_SERVICE_ACCOUNT
    ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    : cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Converte \n em quebra de linha real (necessário em env vars)
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      });

  _app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: credencial });

  return _app;
}
