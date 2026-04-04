// api/cakto-token.js
// Obtém e armazena em cache o token OAuth2 da Cakto.
// A Cakto usa client_credentials — token válido por ~10 horas.

let cachedToken = null;
let tokenExpiresAt = 0;

export async function getCaktoToken() {
  // Reutiliza o token se ainda válido (com 5 min de margem)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const resp = await fetch('https://api.cakto.com.br/public_api/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.CAKTO_CLIENT_ID,
      client_secret: process.env.CAKTO_CLIENT_SECRET,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Cakto auth falhou: ${err}`);
  }

  const data = await resp.json();
  cachedToken   = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}
