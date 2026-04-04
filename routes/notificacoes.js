/* ══════════════════════════════════════════
   ROUTES/NOTIFICACOES.JS
   Notificações para cliente e admin
   Barbearia do Davi
══════════════════════════════════════════ */

/* ── Monta mensagem WhatsApp para cliente ── */
export function mensagemWhatsAppCliente({ cliente, servicos, data, horario, total }) {
  return encodeURIComponent(
    `✂ *Barbearia do Davi* – Agendamento!\n` +
    `👤 *Cliente:* ${cliente}\n` +
    `✂ *Serviços:* ${servicos}\n` +
    `📅 *Data:* ${data} às ${horario}\n` +
    `💰 *Total:* R$ ${total}\n` +
    `✅ Confirmado via Pix\n` +
    `📍 Vila Guará · Luziânia – GO`
  );
}

/* ── Abre WhatsApp com a mensagem ── */
export function compartilharWhatsApp(dados) {
  const msg = mensagemWhatsAppCliente(dados);
  window.open('https://wa.me/?text=' + msg, '_blank');
}

/* ── Notifica admin via WhatsApp ── */
export function notificarAdmin(dados, numeroAdmin) {
  if (!numeroAdmin) return;
  const msg = encodeURIComponent(
    `🔔 *Novo agendamento!*\n` +
    `👤 ${dados.cliente}\n` +
    `📱 ${dados.telefone}\n` +
    `✂ ${dados.servicos}\n` +
    `📅 ${dados.data} às ${dados.horario}\n` +
    `💰 R$ ${dados.total}`
  );
  window.open(`https://wa.me/${numeroAdmin}?text=${msg}`, '_blank');
}

/* ── Salva notificação no Firestore ── */
export async function salvarNotificacao(tipo, dados) {
  if (!window._fb) return;
  const { collection, addDoc, db } = window._fb;
  try {
    await addDoc(collection(db, 'notificacoes'), {
      tipo,
      dados,
      lida: false,
      criadoEm: new Date().toISOString(),
    });
  } catch (e) { /* ignora */ }
}
