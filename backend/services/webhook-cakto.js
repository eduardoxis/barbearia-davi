// api/webhook-cakto.js
// A Cakto chama esta URL quando o Pix é pago (evento: purchase_approved).
// Você configura esta URL no painel: Cakto → Integrações → Webhooks.
//
// EVENTOS QUE TRATAMOS:
//   purchase_approved → Pix confirmado, agendamento garantido ✅
//   purchase_refused  → Pagamento recusado ❌
//   pix_gerado        → Pix criado (aguardando pagamento)

import crypto from 'crypto';

export default async function handler(req, res) {
  // Cakto sempre envia POST
  if (req.method !== 'POST') return res.status(405).end();

  // ── Verificação de assinatura (segurança) ──────────────────────────────────
  // A Cakto envia o campo "secret" no webhook (retornado ao criar o webhook).
  // Valide para garantir que a requisição veio da Cakto, não de terceiros.
  const webhookSecret = process.env.CAKTO_WEBHOOK_SECRET; // ex: 8a67e42d-08b9-...

  if (webhookSecret) {
    const receivedSecret = req.headers['x-cakto-secret'] || req.body?.fields?.secret;
    if (receivedSecret !== webhookSecret) {
      console.warn('⚠️ Webhook com secret inválido — ignorado.');
      return res.status(401).json({ error: 'Assinatura inválida.' });
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const payload = req.body;
  const evento  = payload?.event?.custom_id || payload?.event;

  console.log(`📬 Webhook Cakto recebido: ${evento}`);
  console.log(JSON.stringify(payload, null, 2));

  // ── purchase_approved: PIX PAGO ✅ ────────────────────────────────────────
  if (evento === 'purchase_approved') {
    const pedido   = payload.order || payload;
    const cliente  = pedido?.customer?.name  || 'Cliente';
    const telefone = pedido?.customer?.phone || '';
    const email    = pedido?.customer?.email || '';
    const valor    = pedido?.amount          || pedido?.baseAmount || '?';

    // Recupera o ID do agendamento que guardamos no utm_campaign
    const pedidoId = pedido?.utm_campaign || pedido?.metadata?.pedidoId || '';

    console.log(`✅ PAGAMENTO APROVADO!`);
    console.log(`   Pedido Cakto: ${pedido?.id || pedido?.refId}`);
    console.log(`   Agendamento ID: ${pedidoId}`);
    console.log(`   Cliente: ${cliente} | Tel: ${telefone}`);
    console.log(`   Valor: R$ ${valor}`);

    // ── Aqui você pode adicionar integrações extras: ────────────────────────
    //
    // 1. CONFIRMAR agendamento no banco de dados (Supabase, PlanetScale, etc):
    //    await confirmarAgendamento(pedidoId, { cliente, telefone, email, valor });
    //
    // 2. WHATSAPP para o cliente (via Z-API, Twilio ou Evolution API):
    //    await enviarWhatsApp(telefone,
    //      `✅ *Barbearia do Davi* — Agendamento confirmado!\n` +
    //      `Obrigado, ${cliente}! Te esperamos no horário marcado. 💈`
    //    );
    //
    // 3. WHATSAPP para o Davi (aviso de novo agendamento):
    //    await enviarWhatsApp(process.env.DAVI_WHATSAPP,
    //      `🔔 Novo agendamento confirmado!\nCliente: ${cliente}\nPedido: ${pedidoId}`
    //    );
    // ────────────────────────────────────────────────────────────────────────

    return res.status(200).json({ recebido: true, status: 'aprovado' });
  }

  // ── purchase_refused: pagamento recusado ─────────────────────────────────
  if (evento === 'purchase_refused') {
    const pedidoId = payload?.order?.utm_campaign || '';
    console.log(`❌ Pagamento recusado. Agendamento ID: ${pedidoId}`);
    // Aqui: marcar agendamento como cancelado no banco
    return res.status(200).json({ recebido: true, status: 'recusado' });
  }

  // ── pix_gerado: Pix criado (cliente ainda não pagou) ─────────────────────
  if (evento === 'pix_gerado') {
    console.log('🕐 Pix gerado, aguardando pagamento...');
    return res.status(200).json({ recebido: true, status: 'aguardando' });
  }

  // Evento não tratado — retorna 200 para a Cakto não reenviar
  return res.status(200).json({ recebido: true, status: 'ignorado', evento });
}
