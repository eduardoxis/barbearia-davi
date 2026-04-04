/* ══════════════════════════════════════════════════════════════
   BACKEND/SERVICES/LEMBRETES.JS
   Serviço de Lembretes Automáticos – Barbearia do Davi
   Dispara 2 horas antes do atendimento via WhatsApp, SMS e E-mail
══════════════════════════════════════════════════════════════ */

import { enviarWhatsApp }   from './canais/whatsapp.js';
import { enviarSMS }        from './canais/sms.js';
import { enviarEmail }      from './canais/email.js';
import { initFirebaseAdmin } from '../database/firebase-admin.js';

/* ── Configurações ──────────────────────────────────────────── */
const ANTECEDENCIA_HORAS  = 2;          // Horas antes do atendimento
const TOLERANCIA_MINUTOS  = 10;         // Janela de checagem (±10 min)
const ENDERECO_BARBEARIA  = 'Vila Guará · Luziânia – GO';
const SITE_URL            = process.env.SITE_URL || 'https://barbearia-do-davi.vercel.app';

/* ── Monta a mensagem de lembrete ───────────────────────────── */
export function montarMensagemLembrete(agendamento, incluirLink = true) {
  const { cliente, servicos, data, horario } = agendamento;

  const servicosTexto = Array.isArray(servicos)
    ? servicos.join(' + ')
    : servicos;

  const linkRemarcar = incluirLink
    ? `\n🔗 Precisa remarcar? Acesse: ${SITE_URL}/historico (mín. 24h antes)`
    : '';

  return (
    `Olá, ${cliente}! ✂️\n\n` +
    `Seu horário na *Barbearia do Davi* é *hoje às ${horario}* ` +
    `para *${servicosTexto}*.\n\n` +
    `📍 ${ENDERECO_BARBEARIA}` +
    linkRemarcar
  );
}

/* ── Verifica se o agendamento entra na janela de lembrete ─── */
function deveEnviarLembrete(agendamento, agora = new Date()) {
  // Só agendamentos confirmados que ainda não receberam lembrete
  if (agendamento.status !== 'confirmado') return false;
  if (agendamento.lembreteEnviado)         return false;

  const { data, horario } = agendamento;
  if (!data || !horario) return false;

  // Converte "DD/MM/YYYY" + "HH:MM" para Date
  const [dia, mes, ano] = data.split('/');
  const [hora, min]     = horario.split(':');
  const dtAtend = new Date(ano, mes - 1, dia, parseInt(hora), parseInt(min || 0));

  const diffMs      = dtAtend - agora;
  const diffMinutos = diffMs / (1000 * 60);

  const alvoMinutos = ANTECEDENCIA_HORAS * 60;
  const inferior    = alvoMinutos - TOLERANCIA_MINUTOS;
  const superior    = alvoMinutos + TOLERANCIA_MINUTOS;

  return diffMinutos >= inferior && diffMinutos <= superior;
}

/* ── Envia lembrete por todos os canais configurados ─────────── */
async function dispararLembrete(agendamento) {
  const resultados = { id: agendamento.id, canais: {} };
  const mensagem   = montarMensagemLembrete(agendamento);

  const tarefas = [];

  // WhatsApp – obrigatório se tiver telefone
  if (agendamento.telefone) {
    tarefas.push(
      enviarWhatsApp({ numero: agendamento.telefone, mensagem })
        .then(ok  => { resultados.canais.whatsapp = ok ? 'ok' : 'falhou'; })
        .catch(e  => { resultados.canais.whatsapp = `erro: ${e.message}`; })
    );
  }

  // SMS – opcional, requer Twilio configurado
  if (agendamento.telefone && process.env.TWILIO_ACCOUNT_SID) {
    tarefas.push(
      enviarSMS({ numero: agendamento.telefone, mensagem })
        .then(ok  => { resultados.canais.sms = ok ? 'ok' : 'falhou'; })
        .catch(e  => { resultados.canais.sms = `erro: ${e.message}`; })
    );
  }

  // E-mail – opcional, requer SMTP/SendGrid configurado
  if (agendamento.email && process.env.SMTP_HOST) {
    tarefas.push(
      enviarEmail({
        para:      agendamento.email,
        cliente:   agendamento.cliente,
        servicos:  agendamento.servicos,
        data:      agendamento.data,
        horario:   agendamento.horario,
        linkRemarcar: `${SITE_URL}/historico`,
      })
        .then(ok  => { resultados.canais.email = ok ? 'ok' : 'falhou'; })
        .catch(e  => { resultados.canais.email = `erro: ${e.message}`; })
    );
  }

  await Promise.allSettled(tarefas);
  return resultados;
}

/* ── Marca lembrete como enviado no Firestore ────────────────── */
async function marcarLembreteEnviado(db, agendamentoId, canais) {
  const { doc, updateDoc } = await import('firebase-admin/firestore');
  await db.doc(`agendamentos/${agendamentoId}`).update({
    lembreteEnviado:   true,
    lembreteEnviadoEm: new Date().toISOString(),
    lembreteCanais:    canais,
  });
}

/* ── Função principal chamada pelo Cron ──────────────────────── */
export async function processarLembretes() {
  const app = initFirebaseAdmin();
  const db  = app.firestore();

  const agora = new Date();

  // Busca agendamentos confirmados e sem lembrete ainda
  const snap = await db.collection('agendamentos')
    .where('status', '==', 'confirmado')
    .where('lembreteEnviado', '==', false)
    .get()
    .catch(async () =>
      // fallback se campo não existir no índice
      db.collection('agendamentos').where('status', '==', 'confirmado').get()
    );

  const agendamentos = [];
  snap.forEach(d => agendamentos.push({ id: d.id, ...d.data() }));

  const pendentes = agendamentos.filter(a => deveEnviarLembrete(a, agora));

  console.log(`[lembretes] ${agendamentos.length} confirmados — ${pendentes.length} para enviar agora.`);

  const relatorio = [];

  for (const agendamento of pendentes) {
    try {
      const resultado = await dispararLembrete(agendamento);
      await marcarLembreteEnviado(db, agendamento.id, resultado.canais);
      relatorio.push({ ...resultado, sucesso: true });
      console.log(`[lembretes] ✅ ${agendamento.cliente} (${agendamento.horario})`, resultado.canais);
    } catch (erro) {
      console.error(`[lembretes] ❌ ${agendamento.id}:`, erro.message);
      relatorio.push({ id: agendamento.id, sucesso: false, erro: erro.message });
    }
  }

  return { processados: pendentes.length, relatorio };
}

export { deveEnviarLembrete };
