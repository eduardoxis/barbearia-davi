// api/criar-checkout.js
// Cria uma URL de checkout Cakto para o cliente pagar via Pix.
//
// COMO FUNCIONA COM A CAKTO:
// A Cakto é uma plataforma de checkout — você não gera o QR Code diretamente.
// O fluxo é: seu site → cria oferta/link de checkout Cakto → cliente paga lá →
// Cakto envia webhook "purchase_approved" para o seu servidor → confirma agendamento.
//
// Para a barbearia, criamos UMA oferta "Agendamento" com valor variável usando
// o endpoint de atualização de oferta antes de redirecionar o cliente.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { cliente, whatsapp, servicos, total, data, horario, pedidoId } = req.body;

  if (!cliente || !total || !pedidoId) {
    return res.status(400).json({ error: 'Dados obrigatórios ausentes.' });
  }

  try {
    const { getCaktoToken } = await import('./cakto-token.js');
    const token = await getCaktoToken();

    // 1️⃣ Atualiza o preço da oferta "Agendamento" com o valor exato do pedido
    //    Isso garante que o cliente pague exatamente o que foi selecionado.
    const ofertaId = process.env.CAKTO_OFFER_ID; // ID da oferta criada no painel Cakto

    const updateResp = await fetch(`https://api.cakto.com.br/public_api/offers/${ofertaId}/`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price: Number(total),
        // Descrição com os dados do agendamento (aparece no checkout Cakto)
        description: `Agendamento: ${servicos} | ${data} às ${horario} | Cliente: ${cliente}`,
      }),
    });

    if (!updateResp.ok) {
      const err = await updateResp.json();
      throw new Error(`Erro ao atualizar oferta: ${JSON.stringify(err)}`);
    }

    // 2️⃣ Monta a URL de checkout com parâmetros UTM para rastrear o agendamento
    //    O checkoutUrl base fica no produto no painel da Cakto (ex: pay.cakto.com.br/XXXXX)
    const baseCheckoutUrl = process.env.CAKTO_CHECKOUT_URL; // ex: https://pay.cakto.com.br/davi123

    const params = new URLSearchParams({
      utm_source:   'site_barbearia',
      utm_medium:   'agendamento',
      utm_campaign: pedidoId,          // ID único do agendamento — rastreado no webhook
      utm_content:  encodeURIComponent(`${data}_${horario}`),
      // Pré-preenche nome e telefone no checkout Cakto
      name:  cliente,
      phone: whatsapp || '',
    });

    const checkoutUrl = `${baseCheckoutUrl}?${params.toString()}`;

    return res.status(200).json({
      checkoutUrl,
      pedidoId,
      total,
    });

  } catch (err) {
    console.error('Erro criar-checkout:', err);
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  }
}
