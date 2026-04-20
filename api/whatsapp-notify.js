/* ══════════════════════════════════════════
   API/WHATSAPP-NOTIFY.JS
   Notifica o barbeiro via CallMeBot quando
   um novo agendamento é criado.
   Chamado pelo frontend após criarAgendamento().
══════════════════════════════════════════ */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const phone  = process.env.CALLMEBOT_PHONE;
  const apikey = process.env.CALLMEBOT_APIKEY;

  if (!phone || !apikey) {
    // Sem configuração — responde OK sem enviar (não quebra o fluxo)
    return res.status(200).json({ ok: false, motivo: 'WhatsApp não configurado.' });
  }

  const { cliente, data, horario, servicos, total, barbeiro } = req.body || {};

  if (!cliente || !data || !horario) {
    return res.status(400).json({ error: 'Dados insuficientes.' });
  }

  const texto =
    `✂️ *NOVO AGENDAMENTO*\n` +
    `👤 ${cliente}\n` +
    `📅 ${data} às ${horario}\n` +
    `💈 ${barbeiro || 'Qualquer barbeiro'}\n` +
    `🛎️ ${servicos || '—'}\n` +
    `💰 R$ ${total || '—'}`;

  try {
    const url =
      `https://api.callmebot.com/whatsapp.php` +
      `?phone=${encodeURIComponent(phone)}` +
      `&text=${encodeURIComponent(texto)}` +
      `&apikey=${encodeURIComponent(apikey)}`;

    const resp = await fetch(url);
    const body = await resp.text();

    if (!resp.ok) {
      return res.status(502).json({ ok: false, callmebot: body });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
