/* ══════════════════════════════════════════════════════════════
   BACKEND/SERVICES/CANAIS/WHATSAPP.JS
   Envio via Evolution API (auto-hospedável) ou fallback wa.me
   Barbearia do Davi
══════════════════════════════════════════════════════════════ */

const EVOLUTION_URL      = process.env.EVOLUTION_API_URL;      // ex: https://evo.suadomain.com
const EVOLUTION_KEY      = process.env.EVOLUTION_API_KEY;      // chave da instância
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'barbearia-davi';

/* ── Formata número para padrão internacional ────────────────── */
function formatarNumero(numero) {
  // Remove tudo que não for dígito
  let n = numero.replace(/\D/g, '');

  // Adiciona DDI Brasil se não tiver
  if (!n.startsWith('55')) n = '55' + n;

  // Remove o 9 extra de números com 9 dígitos no DDD (ex: 5562999999999 → 556299999999)
  // A Evolution API aceita ambos; mantemos o formato original com 9
  return n;
}

/* ── Envia mensagem via Evolution API ────────────────────────── */
async function enviarViaEvolution(numero, mensagem) {
  if (!EVOLUTION_URL || !EVOLUTION_KEY) {
    throw new Error('Evolution API não configurada (EVOLUTION_API_URL ou EVOLUTION_API_KEY ausente).');
  }

  const url = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`;

  const response = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey':        EVOLUTION_KEY,
    },
    body: JSON.stringify({
      number:  formatarNumero(numero),
      options: { delay: 1000, presence: 'composing' },
      textMessage: { text: mensagem },
    }),
  });

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`Evolution API ${response.status}: ${erro}`);
  }

  const data = await response.json();
  return data?.key?.id ? true : false;
}

/* ── Ponto de entrada público ────────────────────────────────── */
export async function enviarWhatsApp({ numero, mensagem }) {
  if (!numero) return false;

  try {
    return await enviarViaEvolution(numero, mensagem);
  } catch (erro) {
    // Log e relança para que lembretes.js registre o erro
    console.error('[whatsapp]', erro.message);
    throw erro;
  }
}

/* ── Utilitário: gera link wa.me (para uso no frontend) ─────── */
export function gerarLinkWhatsApp(numero, mensagem) {
  const n   = formatarNumero(numero);
  const msg = encodeURIComponent(mensagem);
  return `https://wa.me/${n}?text=${msg}`;
}
