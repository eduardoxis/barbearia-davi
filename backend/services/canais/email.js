/* ══════════════════════════════════════════════════════════════
   BACKEND/SERVICES/CANAIS/EMAIL.JS
   Envio de e-mail via SMTP (Nodemailer) ou SendGrid
   Barbearia do Davi
══════════════════════════════════════════════════════════════ */

/* ── Detecta qual provider usar ─────────────────────────────── */
const USA_SENDGRID = !!process.env.SENDGRID_API_KEY;
const USA_SMTP     = !!process.env.SMTP_HOST;

const REMETENTE_NOME  = process.env.EMAIL_FROM_NAME  || 'Barbearia do Davi';
const REMETENTE_EMAIL = process.env.EMAIL_FROM_EMAIL || 'noreply@barbearia-davi.com.br';

/* ── Template HTML do lembrete ──────────────────────────────── */
function gerarHTMLLembrete({ cliente, servicos, data, horario, linkRemarcar }) {
  const servicosTexto = Array.isArray(servicos) ? servicos.join(' + ') : servicos;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body        { font-family: Arial, sans-serif; background:#f4f4f4; margin:0; padding:20px; }
    .card       { background:#fff; max-width:480px; margin:0 auto; border-radius:12px;
                  padding:32px; box-shadow:0 2px 8px rgba(0,0,0,.1); }
    .logo       { font-size:22px; font-weight:bold; color:#1a1a1a; margin-bottom:4px; }
    .subtitle   { color:#888; font-size:13px; margin-bottom:24px; }
    .info-row   { display:flex; gap:12px; margin-bottom:14px; align-items:flex-start; }
    .info-icon  { font-size:20px; min-width:28px; }
    .info-label { font-size:12px; color:#888; }
    .info-value { font-size:15px; font-weight:600; color:#1a1a1a; }
    .btn        { display:inline-block; margin-top:24px; padding:12px 28px;
                  background:#1a1a1a; color:#fff; border-radius:8px; text-decoration:none;
                  font-size:14px; font-weight:600; }
    .footer     { margin-top:28px; font-size:12px; color:#aaa; text-align:center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">✂ Barbearia do Davi</div>
    <div class="subtitle">Lembrete de agendamento</div>

    <div class="info-row">
      <span class="info-icon">👤</span>
      <div>
        <div class="info-label">Cliente</div>
        <div class="info-value">${cliente}</div>
      </div>
    </div>

    <div class="info-row">
      <span class="info-icon">✂</span>
      <div>
        <div class="info-label">Serviço</div>
        <div class="info-value">${servicosTexto}</div>
      </div>
    </div>

    <div class="info-row">
      <span class="info-icon">📅</span>
      <div>
        <div class="info-label">Horário</div>
        <div class="info-value">Hoje às ${horario}</div>
      </div>
    </div>

    <div class="info-row">
      <span class="info-icon">📍</span>
      <div>
        <div class="info-label">Endereço</div>
        <div class="info-value">Vila Guará · Luziânia – GO</div>
      </div>
    </div>

    <a href="${linkRemarcar}" class="btn">Remarcar (mín. 24h antes)</a>

    <div class="footer">
      Caso não queira mais receber lembretes, entre em contato conosco.
    </div>
  </div>
</body>
</html>`;
}

/* ── Envio via SMTP (Nodemailer) ─────────────────────────────── */
async function enviarViaSmtp(opcoes) {
  const nodemailer = await import('nodemailer');

  const transporter = nodemailer.default.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from:    `"${REMETENTE_NOME}" <${REMETENTE_EMAIL}>`,
    to:      opcoes.para,
    subject: `✂ Lembrete: seu horário é hoje às ${opcoes.horario} – Barbearia do Davi`,
    html:    gerarHTMLLembrete(opcoes),
  });

  return !!info.messageId;
}

/* ── Envio via SendGrid ──────────────────────────────────────── */
async function enviarViaSendGrid(opcoes) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
    },
    body: JSON.stringify({
      from:             { email: REMETENTE_EMAIL, name: REMETENTE_NOME },
      personalizations: [{ to: [{ email: opcoes.para }] }],
      subject: `✂ Lembrete: seu horário é hoje às ${opcoes.horario} – Barbearia do Davi`,
      content: [{ type: 'text/html', value: gerarHTMLLembrete(opcoes) }],
    }),
  });

  return response.status === 202;
}

/* ── Ponto de entrada público ────────────────────────────────── */
export async function enviarEmail(opcoes) {
  if (!opcoes.para) return false;

  if (USA_SENDGRID)   return enviarViaSendGrid(opcoes);
  if (USA_SMTP)       return enviarViaSmtp(opcoes);

  throw new Error('Nenhum provider de e-mail configurado (SENDGRID_API_KEY ou SMTP_HOST ausente).');
}
