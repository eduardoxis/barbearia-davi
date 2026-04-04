// api/status-pedido.js
// O frontend chama GET /api/status-pedido?id=PEDIDO_ID a cada 4 segundos
// para saber se o webhook de confirmação já foi recebido.
//
// Como a Vercel não tem banco de dados embutido, usamos um Map em memória
// (funciona para testes). Em produção, use Supabase, Redis ou KV Store da Vercel.

// ── Armazenamento em memória (substituir por banco em produção) ──────────────
// Em produção use: import { kv } from '@vercel/kv';
const pedidos = new Map();
// Exemplo: pedidos.set('abc123', { status: 'pendente', confirmedAt: null })

// Exporta para que webhook-cakto.js possa atualizar o status
export { pedidos };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST interno: webhook-cakto.js atualiza o status
  if (req.method === 'POST') {
    const { pedidoId, status } = req.body;
    if (pedidoId && status) {
      pedidos.set(pedidoId, { status, updatedAt: new Date().toISOString() });
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'pedidoId e status obrigatórios.' });
  }

  // GET: frontend verifica status
  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID não informado.' });

    const pedido = pedidos.get(id);
    if (!pedido) {
      return res.status(200).json({ status: 'pendente' });
    }
    return res.status(200).json(pedido);
  }

  return res.status(405).end();
}
