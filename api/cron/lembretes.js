/* ══════════════════════════════════════════════════════════════
   API/CRON/LEMBRETES.JS
   Endpoint chamado pelo Vercel Cron a cada 10 minutos
   Vercel executa: GET /api/cron/lembretes (com Authorization header)
══════════════════════════════════════════════════════════════ */

import { processarLembretes } from '../../backend/services/lembretes.js';

export const config = {
  // Mantém a função ativa por até 60 segundos (plano Hobby: 10s)
  maxDuration: 60,
};

export default async function handler(req, res) {
  // Aceita apenas GET (requisições do Cron)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // Valida o token de segurança do Cron
  // A Vercel injeta automaticamente: Authorization: Bearer <CRON_SECRET>
  const tokenRecebido = req.headers.authorization?.replace('Bearer ', '');
  const tokenEsperado = process.env.CRON_SECRET;

  if (tokenEsperado && tokenRecebido !== tokenEsperado) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  try {
    const inicio   = Date.now();
    const resultado = await processarLembretes();
    const duracao  = Date.now() - inicio;

    console.log(`[cron/lembretes] Concluído em ${duracao}ms`, resultado);

    return res.status(200).json({
      ok:           true,
      duracao_ms:   duracao,
      processados:  resultado.processados,
      relatorio:    resultado.relatorio,
      executadoEm:  new Date().toISOString(),
    });
  } catch (erro) {
    console.error('[cron/lembretes] Erro fatal:', erro);
    return res.status(500).json({ ok: false, erro: erro.message });
  }
}
