/* ══════════════════════════════════════════════════════════════
   BACKEND/SERVICES/CANAIS/SMS.JS
   Envio de SMS via Twilio
   Barbearia do Davi
══════════════════════════════════════════════════════════════ */

const ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER  = process.env.TWILIO_FROM_NUMBER;  // ex: +15551234567 ou número Twilio

/* ── Limpa mensagem para SMS (sem emojis) ───────────────────── */
function limparParaSMS(texto) {
  return texto
    .replace(/[^\x00-\x7FÀ-ÿ\n]/gu, '')   // remove emojis
    .replace(/\*/g, '')                      // remove markdown bold
    .trim();
}

/* ── Formata número para E.164 ────────────────────────────────  */
function formatarE164(numero) {
  let n = numero.replace(/\D/g, '');
  if (!n.startsWith('55')) n = '55' + n;
  return '+' + n;
}

/* ── Envia SMS via Twilio REST API ──────────────────────────── */
export async function enviarSMS({ numero, mensagem }) {
  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    throw new Error('Twilio não configurado (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN ou TWILIO_FROM_NUMBER ausente).');
  }

  const corpo = limparParaSMS(mensagem);
  const para  = formatarE164(numero);

  const credencial = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
  const url        = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;

  const params = new URLSearchParams({
    To:   para,
    From: FROM_NUMBER,
    Body: corpo,
  });

  const response = await fetch(url, {
    method:  'POST',
    headers: {
      'Authorization': `Basic ${credencial}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Twilio ${data.code}: ${data.message}`);
  }

  // Status 'queued' ou 'sent' = sucesso
  return ['queued', 'sent', 'delivered'].includes(data.status);
}
