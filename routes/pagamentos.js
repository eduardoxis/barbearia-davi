/* ══════════════════════════════════════════
   ROUTES/PAGAMENTOS.JS
   Integração Cakto (checkout + polling)
   Barbearia do Davi
══════════════════════════════════════════ */

export const BACKEND_URL = 'https://SEU-PROJETO.vercel.app';

/* ── Cria checkout Cakto ── */
export async function criarCheckoutCakto({ cliente, whatsapp, servicos, total, data, horario, pedidoId }) {
  const res = await fetch(BACKEND_URL + '/api/criar-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cliente, whatsapp, servicos, total, data, horario, pedidoId }),
  });
  const d = await res.json();
  if (!res.ok || !d.checkoutUrl) throw new Error(d.error || 'Erro ao gerar link.');
  return d;
}

/* ── Verifica status do pedido ── */
export async function verificarStatusPedido(pedidoId) {
  const res = await fetch(BACKEND_URL + '/api/status-pedido?id=' + pedidoId);
  return res.json();
}

/* ── Gera ID único de pedido ── */
export function gerarPedidoId() {
  return 'DAV-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

/* ── Timer de expiração do Pix ── */
export function iniciarTimerPix(segundos, onTick, onExpire) {
  let sec = segundos;
  const tick = () => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    onTick(m + ':' + s, sec <= 60);
    if (sec-- <= 0) { clearInterval(id); if (onExpire) onExpire(); }
  };
  tick();
  const id = setInterval(tick, 1000);
  return id;
}
