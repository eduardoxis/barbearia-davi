/* ══════════════════════════════════════════
   API/LEMBRETE-CRON.JS
   Roda todo dia às 11:00 UTC (08:00 BRT).
   Busca agendamentos de AMANHÃ no Firestore
   e envia um resumo via CallMeBot para o barbeiro.
══════════════════════════════════════════ */

export default async function handler(req, res) {
  // Vercel invoca crons com método GET e o header x-vercel-signature
  // Para segurança mínima, verificamos CRON_SECRET quando presente
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers['authorization'] || '';
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }
  }

  const phone  = process.env.CALLMEBOT_PHONE;
  const apikey = process.env.CALLMEBOT_APIKEY;
  const fbKey  = process.env.FIREBASE_API_KEY || 'AIzaSyDK0bmVX9tTMCLw7fSDBrW-E8D3SK63DaY';
  const fbProj = 'barbearia-davi';

  if (!phone || !apikey) {
    return res.status(200).json({ ok: false, motivo: 'WhatsApp não configurado.' });
  }

  // Calcula data de amanhã no formato DD/MM/YYYY (fuso -3)
  const agora    = new Date();
  const amanhaUTC = new Date(agora.getTime() + 86400000);
  // Ajusta para BRT (UTC-3)
  const amanha   = new Date(amanhaUTC.getTime() - 3 * 60 * 60 * 1000);
  const dd  = String(amanha.getUTCDate()).padStart(2, '0');
  const mm  = String(amanha.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = amanha.getUTCFullYear();
  const dataAmanha = `${dd}/${mm}/${yyyy}`;

  // Consulta Firestore via REST
  let agendamentos = [];
  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/${fbProj}` +
      `/databases/(default)/documents:runQuery?key=${fbKey}`;

    const body = {
      structuredQuery: {
        from: [{ collectionId: 'agendamentos' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: 'data' },
                  op: 'EQUAL',
                  value: { stringValue: dataAmanha },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: 'status' },
                  op: 'EQUAL',
                  value: { stringValue: 'confirmado' },
                },
              },
            ],
          },
        },
        orderBy: [{ field: { fieldPath: 'horario' }, direction: 'ASCENDING' }],
      },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(502).json({ ok: false, firestore: txt });
    }

    const docs = await resp.json();
    agendamentos = docs
      .filter(d => d.document?.fields)
      .map(d => {
        const f = d.document.fields;
        const str = key => f[key]?.stringValue || '';
        return {
          cliente:  str('cliente'),
          horario:  str('horario'),
          servicos: str('servicos'),
          barbeiro: str('barbeiro'),
          total:    str('total'),
        };
      });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }

  if (!agendamentos.length) {
    // Sem agendamentos — ainda assim avisa o barbeiro
    await _enviar(phone, apikey,
      `📅 *Agenda de amanhã (${dataAmanha})*\n\nNenhum agendamento confirmado. 😌`);
    return res.status(200).json({ ok: true, total: 0 });
  }

  // Monta resumo
  const linhas = agendamentos.map(
    a => `• ${a.horario} – ${a.cliente} (${a.servicos}) R$${a.total}`
  );

  const texto =
    `📅 *Agenda de amanhã (${dataAmanha})*\n` +
    `Total: ${agendamentos.length} agendamento(s)\n\n` +
    linhas.join('\n');

  await _enviar(phone, apikey, texto);
  return res.status(200).json({ ok: true, total: agendamentos.length });
}

async function _enviar(phone, apikey, texto) {
  const url =
    `https://api.callmebot.com/whatsapp.php` +
    `?phone=${encodeURIComponent(phone)}` +
    `&text=${encodeURIComponent(texto)}` +
    `&apikey=${encodeURIComponent(apikey)}`;
  try { await fetch(url); } catch (_) { /* silencioso — cron não pode travar */ }
}
