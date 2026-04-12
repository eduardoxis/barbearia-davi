/* ══════════════════════════════════════════
   PERFIL.JS — Gamificação e fidelidade
   Barbearia do Davi
══════════════════════════════════════════ */

const FID_NIVEIS = [
  { id:'bronze',   icon:'🥉', nome:'Bronze',   min:1,  max:4,       phrase:'Bem-vindo à família! Continue vindo e suba de nível.' },
  { id:'prata',    icon:'🥈', nome:'Prata',    min:5,  max:9,       phrase:'Você já faz parte dos clientes fiéis. Continue assim!' },
  { id:'ouro',     icon:'🥇', nome:'Ouro',     min:10, max:19,      phrase:'Cliente Ouro! Você é um dos nossos melhores clientes.' },
  { id:'diamante', icon:'💎', nome:'Diamante', min:20, max:Infinity, phrase:'Nível máximo! Você é lenda desta barbearia. 🎖' },
];

const FID_CONQUISTAS = [
  { id:'primeira_vez',  icon:'✂️', label:'Primeiro Corte',  cond: c => c.total >= 1  },
  { id:'fiel_5',        icon:'🔁', label:'5 Visitas',       cond: c => c.total >= 5  },
  { id:'dezena',        icon:'🏅', label:'10 Cortes',       cond: c => c.total >= 10 },
  { id:'veterano',      icon:'🎖', label:'20 Cortes',       cond: c => c.total >= 20 },
  { id:'gastador_500',  icon:'💸', label:'R$ 500 gastos',   cond: c => c.gastoTotal >= 500  },
  { id:'gastador_1k',   icon:'💰', label:'R$ 1.000 gastos', cond: c => c.gastoTotal >= 1000 },
  { id:'mensal',        icon:'📅', label:'Cliente Mensal',  cond: c => c.intervaloMedio !== null && c.intervaloMedio <= 35 },
  { id:'quinzenal',     icon:'⚡', label:'Quinzenal',       cond: c => c.intervaloMedio !== null && c.intervaloMedio <= 18 },
];

function _nivelAtual(cortes) {
  for (let i = FID_NIVEIS.length - 1; i >= 0; i--) {
    if (cortes >= FID_NIVEIS[i].min) return i;
  }
  return 0;
}

function _parseData(dataStr) {
  if (!dataStr) return null;
  const p = dataStr.split('/');
  if (p.length === 3) return new Date(p[2] + '-' + p[1] + '-' + p[0]);
  const d = new Date(dataStr);
  return isNaN(d) ? null : d;
}

function _calcStats(agendamentos) {
  const agora      = new Date();
  const umAnoAtras = new Date(agora.getFullYear()-1, agora.getMonth(), agora.getDate());
  let gastoTotal = 0, gastoAno = 0;
  const datas = [];

  agendamentos.forEach(ag => {
    const v   = parseFloat(ag.total || 0);
    const dat = _parseData(ag.data);
    gastoTotal += v;
    if (dat && dat >= umAnoAtras) gastoAno += v;
    if (dat && !isNaN(dat)) datas.push(dat);
  });

  datas.sort((a, b) => a - b);
  let intervaloMedio = null;
  if (datas.length >= 2) {
    const diffTotal = (datas[datas.length-1] - datas[0]) / 86400000;
    intervaloMedio = Math.round(diffTotal / (datas.length - 1));
  }

  const svcMap = {};
  agendamentos.forEach(ag => {
    (ag.servicos || '').split(',').map(s => s.trim().replace(/^[^\w]+/,'')).filter(Boolean).forEach(sv => {
      svcMap[sv] = (svcMap[sv] || 0) + 1;
    });
  });
  const svcsRank = Object.entries(svcMap).sort((a, b) => b[1] - a[1]);

  return { gastoTotal, gastoAno, intervaloMedio, svcsRank, total: agendamentos.length };
}

/* ── Renderiza painel de fidelidade ── */
export function renderFidelidade(agendamentos) {
  const el = document.getElementById('fidContent');
  if (!el) return;

  const ags = (agendamentos || []).filter(a => a.status !== 'cancelado');

  if (!ags.length) {
    el.innerHTML = `<div style="text-align:center;padding:2rem 1rem">
      <div style="font-size:2.5rem;margin-bottom:0.8rem">✂️</div>
      <div style="font-family:'Oswald',sans-serif;font-size:1rem;color:var(--white);letter-spacing:0.05em;text-transform:uppercase;margin-bottom:0.4rem">Seu programa de fidelidade</div>
      <div style="font-size:0.78rem;color:var(--gray);line-height:1.6">Realize seu primeiro agendamento para começar a acumular pontos!</div>
      <div style="margin-top:1.2rem;display:flex;justify-content:center;gap:0.7rem;flex-wrap:wrap">
        ${FID_NIVEIS.map(n => `<span style="font-size:1.6rem" title="${n.nome}">${n.icon}</span>`).join('')}
      </div>
    </div>`;
    return;
  }

  const stats      = _calcStats(ags);
  const cortes     = stats.total;
  const nivelIdx   = _nivelAtual(cortes);
  const nivel      = FID_NIVEIS[nivelIdx];
  const proximoNivel = FID_NIVEIS[nivelIdx + 1] || null;
  let pct = 100, faltam = 0;
  if (proximoNivel) {
    pct   = Math.min(100, Math.round(((cortes - nivel.min) / (proximoNivel.min - nivel.min)) * 100));
    faltam = proximoNivel.min - cortes;
  }

  const conquistasHTML = FID_CONQUISTAS.map(c => {
    const earned = c.cond(stats);
    return `<span class="fid-conquista ${earned ? 'earned' : 'locked'}">${c.icon} ${c.label}</span>`;
  }).join('');

  const maxSvc = stats.svcsRank[0]?.[1] || 1;
  const svcsHTML = stats.svcsRank.slice(0,4).map(([sv,n]) => `
    <div class="fid-svc-row">
      <div class="fid-svc-name">${sv}</div>
      <div class="fid-svc-bar-wrap"><div class="fid-svc-bar-fill" style="width:${Math.round((n/maxSvc)*100)}%"></div></div>
      <div class="fid-svc-count">${n}x</div>
    </div>`).join('') || '<div style="font-size:0.75rem;color:var(--gray2)">—</div>';

  let freqLabel = '—', freqHint = '';
  if (stats.intervaloMedio !== null) {
    freqLabel = stats.intervaloMedio + ' dias';
    if      (stats.intervaloMedio <= 15) freqHint = '⚡ Quinzenal — você é dedicado!';
    else if (stats.intervaloMedio <= 30) freqHint = '📅 Mensal — excelente frequência.';
    else if (stats.intervaloMedio <= 45) freqHint = '🔁 Regular — continue vindo!';
    else                                 freqHint = '💤 Intervalo longo — sentimos sua falta.';
  }

  const fmtBRL = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });

  el.innerHTML = `
    <div class="fid-nivel-card ${nivel.id} fid-animate">
      <div class="fid-nivel-row">
        <span class="fid-nivel-icon">${nivel.icon}</span>
        <div>
          <span class="fid-nivel-label">Nível atual</span>
          <div class="fid-nivel-name">${nivel.nome}</div>
        </div>
      </div>
      <div class="fid-nivel-phrase">${nivel.phrase}</div>
      ${proximoNivel ? `
      <div class="fid-prog-wrap">
        <div class="fid-prog-labels"><span>${nivel.nome}</span><span>${proximoNivel.nome}</span></div>
        <div class="fid-prog-bar"><div class="fid-prog-fill" id="fidProgFill" style="width:0%"></div></div>
        <div class="fid-prog-next">Faltam <strong>${faltam} corte${faltam!==1?'s':''}</strong> para ${proximoNivel.icon} ${proximoNivel.nome}</div>
      </div>` : `<div style="margin-top:0.8rem;font-size:0.72rem;color:rgba(100,180,255,0.7);font-weight:700">🏆 NÍVEL MÁXIMO — VOCÊ É LENDA!</div>`}
    </div>

    <div class="fid-stats-grid fid-animate" style="animation-delay:0.07s">
      <div class="fid-stat">
        <span class="fid-stat-n">${cortes}</span>
        <span class="fid-stat-l">Cortes realizados</span>
      </div>
      <div class="fid-stat">
        <span class="fid-stat-n">${fmtBRL(stats.gastoTotal)}</span>
        <span class="fid-stat-l">Total investido</span>
        <span class="fid-stat-sub">${fmtBRL(stats.gastoAno)} no último ano</span>
      </div>
    </div>

    <div class="fid-freq-wrap fid-animate" style="animation-delay:0.12s">
      <div class="fid-freq-row">
        <div><div class="fid-freq-n">${freqLabel}</div><div class="fid-freq-l">Frequência média</div></div>
        ${stats.intervaloMedio ? `<div style="font-size:1.8rem;opacity:0.7">${stats.intervaloMedio<=18?'⚡':stats.intervaloMedio<=35?'🔁':'💤'}</div>` : ''}
      </div>
      ${freqHint ? `<div class="fid-freq-hint">${freqHint}</div>` : ''}
    </div>

    <div class="fid-animate" style="animation-delay:0.17s;margin-bottom:0.9rem">
      <div class="fid-svcs-title">✂ Serviços mais feitos</div>
      ${svcsHTML}
    </div>

    <div class="fid-animate" style="animation-delay:0.22s">
      <div class="fid-svcs-title">🏅 Conquistas</div>
      <div class="fid-conquistas">${conquistasHTML}</div>
    </div>`;

  if (proximoNivel) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const fill = document.getElementById('fidProgFill');
      if (fill) fill.style.width = pct + '%';
    }));
  }
}
