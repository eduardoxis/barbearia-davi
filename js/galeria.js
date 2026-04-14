/* ══════════════════════════════════════════
   GALERIA.JS — Sistema de Galeria de Cortes
   Admin : upload câmera/galeria, resize, drag & drop,
           destaque (max 3), tags, limite configurável
   Cliente: thumbnails no card, modal grid, lightbox
            swipe mobile, "Quero esse corte", avaliações
   Barbearia do Davi
══════════════════════════════════════════ */

import { adminSettings, showToast } from './global.js';

/* ─── CONSTANTES ─────────────────────────── */
const MAX_DESTAQUE      = 3;
const DEFAULT_LIMITE    = 20;
const RESIZE_MAX_PX     = 1200;
const TAGS_SUGERIDAS    = ['#degradê','#barba','#navalhado','#clássico','#infantil','#combo','#sobrancelha','#máquina','#fade','#skin'];

/* ─── ESTADO INTERNO ─────────────────────── */
let _dragSrcIdx   = null;   // índice sendo arrastado
let _dragBarbId   = null;
let _lbFotos      = [];     // fotos visíveis no lightbox atual
let _lbIdx        = 0;      // foto atual no lightbox
let _lbBarbId     = null;
let _tagFiltroAtivo = null; // tag selecionada no modal cliente
let _touchStartX  = 0;

/* ════════════════════════════════════════════
   UTILITÁRIOS
════════════════════════════════════════════ */

/** Redimensiona File/Blob para base64 jpeg com max RESIZE_MAX_PX */
async function redimensionarImagem(file, maxPx = RESIZE_MAX_PX) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > maxPx || h > maxPx) {
          if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
          else        { w = Math.round(w * maxPx / h); h = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function getBarbeiro(id) {
  return (adminSettings.barbeiros || []).find(b => b.id === id);
}

function getLimite(b) {
  return b?.limitePortfolio || DEFAULT_LIMITE;
}

/* ════════════════════════════════════════════
   ADMIN — PORTFÓLIO
════════════════════════════════════════════ */

export function renderPortfolioAdmin(barbId) {
  const wrap = document.getElementById('portAdminWrap');
  if (!wrap) return;
  wrap.style.display = 'block';

  const barb   = getBarbeiro(barbId);
  const fotos  = barb?.portfolio || [];
  const limite = getLimite(barb);
  const destaquesUsados = fotos.filter(f => f.destaque).length;

  /* ── Cabeçalho com contador e limite ── */
  const header = document.getElementById('portAdmHeader');
  if (header) {
    header.innerHTML = `
      <span class="port-adm-count">${fotos.length}/${limite} fotos</span>
      <span class="port-adm-dest-count">⭐ ${destaquesUsados}/${MAX_DESTAQUE} destaques</span>
      <div class="port-adm-limite-wrap">
        <label style="font-size:0.72rem;color:var(--gray)">Limite</label>
        <select class="port-adm-limite-sel" onchange="atualizarLimitePortfolio('${barbId}',this.value)">
          ${[10,15,20,30,50].map(n => `<option value="${n}" ${n === limite ? 'selected' : ''}>${n} fotos</option>`).join('')}
        </select>
      </div>`;
  }

  const grid = document.getElementById('portAdminGrid');
  if (!grid) return;

  if (!fotos.length) {
    grid.innerHTML = '<div class="port-adm-empty">Nenhuma foto ainda. Adicione abaixo ↓</div>';
    return;
  }

  grid.innerHTML = fotos.map((p, i) => {
    const destaqueAtivo = p.destaque;
    const tagsHtml = (p.tags || []).map(t =>
      `<span class="port-adm-tag">${t}</span>`).join('');
    return `
    <div class="port-adm-thumb ${destaqueAtivo ? 'eh-destaque' : ''}"
         data-idx="${i}" draggable="true"
         ondragstart="galeAdmDragStart(event,'${barbId}',${i})"
         ondragover="galeAdmDragOver(event)"
         ondrop="galeAdmDrop(event,'${barbId}',${i})"
         ondragend="galeAdmDragEnd()">
      <div class="port-adm-drag-handle">⠿</div>
      <img src="${p.url}" loading="lazy" onerror="this.parentElement.classList.add('broken')">
      ${destaqueAtivo ? '<div class="port-adm-destaque-badge">⭐ Destaque</div>' : ''}
      <div class="port-adm-thumb-overlay">
        <button class="port-adm-act-btn ${destaqueAtivo ? 'ativo' : ''}"
          onclick="toggleDestaquePortfolio('${barbId}',${i})"
          title="${destaqueAtivo ? 'Remover destaque' : 'Marcar como destaque'}">⭐</button>
        <button class="port-adm-act-btn port-adm-tag-btn"
          onclick="abrirEditarTagsFoto('${barbId}',${i})"
          title="Editar tags">#</button>
        <button class="port-adm-act-btn port-adm-del-btn"
          onclick="removerFotoPortfolio('${barbId}',${i})"
          title="Remover">✕</button>
      </div>
      ${tagsHtml ? `<div class="port-adm-tags-row">${tagsHtml}</div>` : ''}
      ${p.caption ? `<div class="port-adm-thumb-caption">${p.caption}</div>` : ''}
    </div>`;
  }).join('');
}

/* ── Upload câmera/galeria + resize ── */
export function triggerUploadFoto() {
  const inp = document.getElementById('portFileInput');
  if (inp) inp.click();
}

export async function onPortFileChange(input) {
  const barbId = document.getElementById('barbIdEditando')?.value;
  if (!barbId) return;
  const barb = getBarbeiro(barbId);
  if (!barb) return;
  if (!barb.portfolio) barb.portfolio = [];

  const limite = getLimite(barb);
  const files  = Array.from(input.files || []);
  if (!files.length) return;

  const disponivel = limite - barb.portfolio.length;
  if (disponivel <= 0) {
    showToast(`⚠️ Limite de ${limite} fotos atingido!`);
    input.value = '';
    return;
  }

  const btn = document.getElementById('portUploadBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Processando…'; }

  const selecionadas = files.slice(0, disponivel);
  let adicionadas = 0;

  for (const file of selecionadas) {
    try {
      const base64 = await redimensionarImagem(file);
      const capEl  = document.getElementById('portNovaCaption');
      barb.portfolio.push({
        url:      base64,
        caption:  capEl?.value.trim() || '',
        destaque: false,
        tags:     [],
        ordem:    barb.portfolio.length,
      });
      adicionadas++;
    } catch (e) { console.warn('Erro ao processar imagem:', e); }
  }

  input.value = '';
  if (btn) { btn.disabled = false; btn.textContent = '📷 Câmera / Galeria'; }
  const capEl = document.getElementById('portNovaCaption');
  if (capEl) capEl.value = '';

  renderPortfolioAdmin(barbId);
  showToast(`📸 ${adicionadas} foto${adicionadas > 1 ? 's' : ''} adicionada${adicionadas > 1 ? 's' : ''}!`);
}

/* ── Adicionar por URL (mantém compatibilidade) ── */
export function adicionarFotoPortfolio() {
  const barbId = document.getElementById('barbIdEditando')?.value;
  const urlEl  = document.getElementById('portNovaUrl');
  const capEl  = document.getElementById('portNovaCaption');
  const errEl  = document.getElementById('portAdmErr');
  const url    = urlEl?.value.trim();

  if (!url) {
    if (errEl) { errEl.textContent = 'Insira a URL da imagem.'; errEl.classList.add('show'); }
    return;
  }
  if (errEl) errEl.classList.remove('show');

  const barb = getBarbeiro(barbId);
  if (!barb) return;
  if (!barb.portfolio) barb.portfolio = [];

  const limite = getLimite(barb);
  if (barb.portfolio.length >= limite) {
    showToast(`⚠️ Limite de ${limite} fotos atingido!`); return;
  }

  barb.portfolio.push({
    url, caption: capEl?.value.trim() || '',
    destaque: false, tags: [], ordem: barb.portfolio.length,
  });
  if (urlEl) urlEl.value = '';
  if (capEl) capEl.value = '';
  renderPortfolioAdmin(barbId);
  showToast('📸 Foto adicionada ao portfólio!');
}

/* ── Remover foto ── */
export function removerFotoPortfolio(barbId, idx) {
  const barb = getBarbeiro(barbId);
  if (!barb?.portfolio) return;
  if (!confirm('Remover esta foto do portfólio?')) return;
  barb.portfolio.splice(idx, 1);
  // Re-numera ordem
  barb.portfolio.forEach((f, i) => { f.ordem = i; });
  renderPortfolioAdmin(barbId);
  showToast('🗑 Foto removida.');
}

/* ── Toggle destaque (max 3) ── */
export function toggleDestaquePortfolio(barbId, idx) {
  const barb = getBarbeiro(barbId);
  if (!barb?.portfolio) return;
  const foto = barb.portfolio[idx];
  if (!foto) return;

  if (foto.destaque) {
    foto.destaque = false;
    showToast('Destaque removido.');
  } else {
    const qtd = barb.portfolio.filter(f => f.destaque).length;
    if (qtd >= MAX_DESTAQUE) {
      showToast(`⭐ Máximo ${MAX_DESTAQUE} destaques por barbeiro!`); return;
    }
    foto.destaque = true;
    showToast('⭐ Foto marcada como destaque!');
  }
  renderPortfolioAdmin(barbId);
}

/* ── Limite configurável ── */
export function atualizarLimitePortfolio(barbId, valor) {
  const barb = getBarbeiro(barbId);
  if (!barb) return;
  barb.limitePortfolio = parseInt(valor);
  renderPortfolioAdmin(barbId);
  showToast(`📏 Limite atualizado para ${valor} fotos.`);
}

/* ── Tags ── */
export function abrirEditarTagsFoto(barbId, idx) {
  const barb = getBarbeiro(barbId);
  const foto = barb?.portfolio?.[idx];
  if (!foto) return;

  // Popula o modal de tags
  document.getElementById('tagsBarbId').value = barbId;
  document.getElementById('tagsFotoIdx').value = idx;
  const tagsAtuais = document.getElementById('tagsAtuaisInput');
  if (tagsAtuais) tagsAtuais.value = (foto.tags || []).join(' ');

  // Renderiza chips sugeridos
  const chips = document.getElementById('tagsChips');
  if (chips) {
    chips.innerHTML = TAGS_SUGERIDAS.map(t => {
      const ativa = (foto.tags || []).includes(t);
      return `<button class="tag-chip ${ativa ? 'ativa' : ''}" onclick="toggleTagChip(this,'${t}')">${t}</button>`;
    }).join('');
  }

  document.getElementById('overlayEditarTags')?.classList.add('show');
}

export function toggleTagChip(btn, tag) {
  btn.classList.toggle('ativa');
  _sincronizarTagsInput();
}

function _sincronizarTagsInput() {
  const chips  = document.querySelectorAll('#tagsChips .tag-chip.ativa');
  const tags   = Array.from(chips).map(c => c.textContent.trim());
  const inp    = document.getElementById('tagsAtuaisInput');
  if (inp) inp.value = tags.join(' ');
}

export function confirmarEditarTags() {
  const barbId = document.getElementById('tagsBarbId')?.value;
  const idx    = parseInt(document.getElementById('tagsFotoIdx')?.value);
  const rawVal = document.getElementById('tagsAtuaisInput')?.value || '';
  const barb   = getBarbeiro(barbId);
  const foto   = barb?.portfolio?.[idx];
  if (!foto) return;

  // Parse: tokens que começam com # ou adiciona #
  foto.tags = rawVal.split(/\s+/).filter(Boolean).map(t => t.startsWith('#') ? t : '#' + t);
  document.getElementById('overlayEditarTags')?.classList.remove('show');
  renderPortfolioAdmin(barbId);
  showToast('🏷 Tags atualizadas!');
}
export function fecharEditarTags() {
  document.getElementById('overlayEditarTags')?.classList.remove('show');
}

/* ── Drag & Drop (HTML5) ── */
export function galeAdmDragStart(e, barbId, idx) {
  _dragSrcIdx = idx;
  _dragBarbId = barbId;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}
export function galeAdmDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  // Destaca target
  document.querySelectorAll('.port-adm-thumb').forEach(el => el.classList.remove('drag-over'));
  e.currentTarget.classList.add('drag-over');
}
export function galeAdmDrop(e, barbId, targetIdx) {
  e.preventDefault();
  if (_dragSrcIdx === null || _dragSrcIdx === targetIdx) return;
  const barb = getBarbeiro(barbId);
  if (!barb?.portfolio) return;

  const arr  = barb.portfolio;
  const item = arr.splice(_dragSrcIdx, 1)[0];
  arr.splice(targetIdx, 0, item);
  arr.forEach((f, i) => { f.ordem = i; });

  _dragSrcIdx = null;
  renderPortfolioAdmin(barbId);
  showToast('🔀 Ordem atualizada!');
}
export function galeAdmDragEnd() {
  _dragSrcIdx = null;
  document.querySelectorAll('.port-adm-thumb').forEach(el => {
    el.classList.remove('dragging', 'drag-over');
  });
}

/* ════════════════════════════════════════════
   ADMIN — CONTADOR DE CORTES
════════════════════════════════════════════ */

/** Chame esta função ao marcar um agendamento como concluído */
export function incrementarContadorCortes(barbId) {
  const barb = getBarbeiro(barbId);
  if (!barb) return;
  barb.totalCortes = (barb.totalCortes || 0) + 1;
}

/* ════════════════════════════════════════════
   CLIENTE — CARD DO BARBEIRO (thumbnails + contador)
════════════════════════════════════════════ */

/** Retorna HTML das thumbnails de destaque para o card do barbeiro */
export function renderDestaquesThumbs(b) {
  const destaques = (b.portfolio || []).filter(f => f.destaque).slice(0, MAX_DESTAQUE);
  if (!destaques.length) return '';

  const thumbs = destaques.map((f, i) =>
    `<div class="barb-dest-thumb" style="animation-delay:${i * 0.08}s">
       <img src="${f.url}" alt="Destaque ${i+1}" loading="lazy"
            onerror="this.parentElement.style.display='none'">
     </div>`
  ).join('');

  return `<div class="barb-destaques-row">${thumbs}</div>`;
}

/** Retorna HTML do contador de cortes */
export function renderContadorCortes(b) {
  const n = b.totalCortes || 0;
  if (!n) return '';
  return `<div class="barb-cortes-count">✂️ ${n} corte${n !== 1 ? 's' : ''} realizados</div>`;
}

/* ════════════════════════════════════════════
   CLIENTE — MODAL GALERIA COMPLETA
════════════════════════════════════════════ */

export function abrirGaleriaBarbeiro(id) {
  const b = (adminSettings.barbeiros || []).find(x => x.id === id && x.ativo !== false);
  if (!b) return;
  _lbBarbId = id;
  _tagFiltroAtivo = null;

  /* ── Avatar + info ── */
  const header = document.getElementById('galeHeader');
  if (header) {
    const fotoHtml = b.foto
      ? `<img src="${b.foto}" class="gale-avatar-img" alt="${b.nome}" onerror="this.style.display='none'">`
      : `<span class="gale-avatar-emoji">${b.emoji || '💈'}</span>`;
    const cortes = b.totalCortes ? `<div class="gale-cortes-badge">✂️ ${b.totalCortes} cortes</div>` : '';
    const nota   = _calcNotaMedia(b);
    const estrelas = nota ? `<div class="gale-nota-badge">${_renderEstrelas(nota)} <span>${nota.toFixed(1)}</span></div>` : '';
    header.innerHTML = `
      <div class="gale-avatar">${fotoHtml}</div>
      <div class="gale-info">
        <div class="gale-nome">${b.nome}</div>
        <div class="gale-esp">${b.especialidade || 'Barbeiro profissional'}</div>
        ${b.bio ? `<div class="gale-bio">${b.bio}</div>` : ''}
        <div class="gale-badges">${cortes}${estrelas}</div>
      </div>`;
  }

  /* ── Tags para filtro ── */
  _renderTagsFiltro(b);

  /* ── Fotos ── */
  _renderFotosGaleria(b, null);

  /* ── Avaliações ── */
  _renderAvaliacoesModal(b);

  /* ── Botão agendar ── */
  const btn = document.getElementById('galeAgendarBtn');
  if (btn) {
    btn.onclick = () => { fecharGaleria(); _selecionarBarbeiroAgendamento(id); };
  }

  document.getElementById('overlayGaleria')?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function _renderTagsFiltro(b) {
  const wrap = document.getElementById('galeTagsFiltro');
  if (!wrap) return;

  // Coleta todas as tags únicas do portfólio
  const todosSet = new Set();
  (b.portfolio || []).forEach(f => (f.tags || []).forEach(t => todosSet.add(t)));
  const tags = Array.from(todosSet);

  if (!tags.length) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = `
    <button class="gale-tag-chip ativa" onclick="galeSetTag(null)">Todos</button>
    ${tags.map(t => `<button class="gale-tag-chip" onclick="galeSetTag('${t}')">${t}</button>`).join('')}`;
}

function _renderFotosGaleria(b, tag) {
  const grid = document.getElementById('galeGrid');
  if (!grid) return;

  let fotos = b.portfolio || [];
  if (tag) fotos = fotos.filter(f => (f.tags || []).includes(tag));

  if (!fotos.length) {
    grid.innerHTML = `<div class="gale-empty">${tag ? `Nenhuma foto com a tag ${tag}` : 'Sem fotos ainda.'}</div>`;
    return;
  }

  // Salva fotos visíveis para lightbox navegar
  _lbFotos = fotos;

  grid.innerHTML = fotos.map((p, i) => {
    const destaquePin = p.destaque ? '<div class="gale-thumb-pin">⭐</div>' : '';
    const tagsHtml = (p.tags || []).map(t => `<span class="gale-thumb-tag">${t}</span>`).join('');
    return `
    <div class="gale-thumb" onclick="abrirLightboxGaleria(${i})" style="animation-delay:${(i % 9) * 0.05}s">
      ${destaquePin}
      <img src="${p.url}" alt="Corte ${i+1}" loading="lazy"
           onerror="this.parentElement.classList.add('broken')">
      <div class="gale-thumb-hover">
        ${p.caption ? `<div class="gale-thumb-caption">${p.caption}</div>` : ''}
        ${tagsHtml ? `<div class="gale-thumb-tags">${tagsHtml}</div>` : ''}
        <div class="gale-thumb-action">Ampliar ↗</div>
      </div>
    </div>`;
  }).join('');
}

export function galeSetTag(tag) {
  _tagFiltroAtivo = tag;
  const b = getBarbeiro(_lbBarbId);
  if (!b) return;

  // Atualiza chips
  document.querySelectorAll('#galeTagsFiltro .gale-tag-chip').forEach(btn => {
    const isAll = btn.textContent === 'Todos';
    btn.classList.toggle('ativa', tag === null ? isAll : btn.textContent === tag);
  });

  _renderFotosGaleria(b, tag);
}

export function fecharGaleria() {
  document.getElementById('overlayGaleria')?.classList.remove('show');
  document.body.style.overflow = '';
  fecharLightboxGaleria();
}

/* ════════════════════════════════════════════
   CLIENTE — LIGHTBOX COM SWIPE + "QUERO ESSE CORTE"
════════════════════════════════════════════ */

export function abrirLightboxGaleria(idx) {
  _lbIdx = idx;
  _atualizarLightbox();
  const lb = document.getElementById('galeOverlayLb');
  if (lb) lb.classList.add('show');
}

function _atualizarLightbox() {
  const foto = _lbFotos[_lbIdx];
  if (!foto) return;

  const img = document.getElementById('galeLbImg');
  if (img) {
    img.style.opacity = '0';
    img.src = foto.url;
    img.onload = () => { img.style.opacity = '1'; };
  }

  const cap = document.getElementById('galeLbCaption');
  if (cap) cap.textContent = foto.caption || '';

  const tags = document.getElementById('galeLbTags');
  if (tags) {
    tags.innerHTML = (foto.tags || []).map(t =>
      `<span class="gale-lb-tag" onclick="galeSetTag('${t}');fecharLightboxGaleria()">${t}</span>`
    ).join('');
  }

  // Atualiza contador
  const counter = document.getElementById('galeLbCounter');
  if (counter) counter.textContent = `${_lbIdx + 1} / ${_lbFotos.length}`;

  // Setas prev/next
  const prev = document.getElementById('galeLbPrev');
  const next = document.getElementById('galeLbNext');
  if (prev) prev.style.visibility = _lbIdx > 0 ? 'visible' : 'hidden';
  if (next) next.style.visibility = _lbIdx < _lbFotos.length - 1 ? 'visible' : 'hidden';
}

export function navLightbox(dir) {
  const novo = _lbIdx + dir;
  if (novo < 0 || novo >= _lbFotos.length) return;
  _lbIdx = novo;
  _atualizarLightbox();
}

export function fecharLightboxGaleria() {
  document.getElementById('galeOverlayLb')?.classList.remove('show');
}

/* Suporte a teclado */
document.addEventListener('keydown', e => {
  const lb = document.getElementById('galeOverlayLb');
  if (!lb?.classList.contains('show')) return;
  if (e.key === 'ArrowLeft')  navLightbox(-1);
  if (e.key === 'ArrowRight') navLightbox(1);
  if (e.key === 'Escape')     fecharLightboxGaleria();
});

/* Suporte a swipe (touch) */
export function lbTouchStart(e) {
  _touchStartX = e.touches[0].clientX;
}
export function lbTouchEnd(e) {
  const delta = e.changedTouches[0].clientX - _touchStartX;
  if (Math.abs(delta) > 50) navLightbox(delta < 0 ? 1 : -1);
}

/* ── "Quero esse corte" ── */
export function queroEsseCorte() {
  const foto = _lbFotos[_lbIdx];
  if (!foto || !_lbBarbId) return;

  // Salva referência para exibir no admin
  try {
    const ref = { barbId: _lbBarbId, fotoUrl: foto.url, caption: foto.caption || '', tags: foto.tags || [], solicitadoEm: new Date().toISOString() };
    const existing = JSON.parse(localStorage.getItem('gale_referencias') || '[]');
    existing.push(ref);
    localStorage.setItem('gale_referencias', JSON.stringify(existing.slice(-50)));
  } catch (_) {}

  fecharLightboxGaleria();
  fecharGaleria();
  _selecionarBarbeiroAgendamento(_lbBarbId);
  showToast('💈 Barbeiro selecionado! Mostre a referência na barbearia.');
}

function _selecionarBarbeiroAgendamento(barbId) {
  // Tenta usar a função de agendamento já exposta globalmente
  if (typeof window.selecionarBarbeiro === 'function') {
    window.selecionarBarbeiro(barbId);
  }
  // Rola até a seção de agendamento
  const secao = document.getElementById('agendamento') || document.querySelector('.agendamento-section');
  if (secao) secao.scrollIntoView({ behavior: 'smooth' });
}

/* ════════════════════════════════════════════
   CLIENTE — AVALIAÇÕES
════════════════════════════════════════════ */

function _calcNotaMedia(b) {
  const avs = b.avaliacoes || [];
  if (!avs.length) return null;
  return avs.reduce((s, a) => s + (a.nota || 0), 0) / avs.length;
}

function _renderEstrelas(nota) {
  const inteiro = Math.round(nota);
  return '★'.repeat(inteiro) + '☆'.repeat(5 - inteiro);
}

function _renderAvaliacoesModal(b) {
  const wrap = document.getElementById('galeAvaliacoes');
  if (!wrap) return;

  const avs = b.avaliacoes || [];
  if (!avs.length) {
    wrap.innerHTML = '<div class="gale-av-empty">Nenhuma avaliação ainda. Seja o primeiro!</div>';
  } else {
    const nota = _calcNotaMedia(b);
    wrap.innerHTML = `
      <div class="gale-av-resumo">
        <span class="gale-av-estrelas-big">${_renderEstrelas(nota)}</span>
        <span class="gale-av-nota-big">${nota.toFixed(1)}</span>
        <span class="gale-av-total">(${avs.length} avaliação${avs.length !== 1 ? 'ões' : ''})</span>
      </div>
      <div class="gale-av-lista">
        ${avs.slice(-5).reverse().map(av => `
          <div class="gale-av-item">
            <div class="gale-av-header">
              <span class="gale-av-estrelas">${_renderEstrelas(av.nota)}</span>
              <span class="gale-av-autor">${av.autor || 'Cliente'}</span>
              <span class="gale-av-data">${av.data || ''}</span>
            </div>
            ${av.comentario ? `<div class="gale-av-comentario">"${av.comentario}"</div>` : ''}
          </div>`).join('')}
      </div>`;
  }

  // Formulário de nova avaliação
  const form = document.getElementById('galeAvForm');
  if (form) {
    form.innerHTML = `
      <div class="gale-av-form-titulo">Deixe sua avaliação</div>
      <div class="gale-av-stars-input" id="galeAvStars">
        ${[1,2,3,4,5].map(n =>
          `<button class="gale-av-star-btn" data-nota="${n}" onclick="galeSetNota(${n})">★</button>`
        ).join('')}
      </div>
      <input class="form-input" id="galeAvComentario" placeholder="Comentário (opcional)" style="margin:0.5rem 0;font-size:0.82rem">
      <input class="form-input" id="galeAvAutor"      placeholder="Seu nome (opcional)" style="font-size:0.82rem">
      <button class="gale-av-submit-btn" onclick="galeEnviarAvaliacao()">Enviar avaliação</button>`;
  }
}

let _avNotaSelecionada = 0;

export function galeSetNota(n) {
  _avNotaSelecionada = n;
  document.querySelectorAll('#galeAvStars .gale-av-star-btn').forEach(btn => {
    btn.classList.toggle('selecionada', parseInt(btn.dataset.nota) <= n);
  });
}

export function galeEnviarAvaliacao() {
  if (!_avNotaSelecionada) { showToast('⭐ Selecione uma nota antes de enviar.'); return; }
  const b = getBarbeiro(_lbBarbId);
  if (!b) return;

  const av = {
    nota:       _avNotaSelecionada,
    comentario: document.getElementById('galeAvComentario')?.value.trim() || '',
    autor:      document.getElementById('galeAvAutor')?.value.trim() || 'Cliente',
    data:       new Date().toLocaleDateString('pt-BR'),
  };

  if (!b.avaliacoes) b.avaliacoes = [];
  b.avaliacoes.push(av);
  _avNotaSelecionada = 0;

  _renderAvaliacoesModal(b);
  showToast('⭐ Avaliação enviada! Obrigado!');

  // Persiste no Firestore se disponível
  if (window._fb) {
    try {
      window._fb.setDoc(
        window._fb.doc(window._fb.db, 'settings', 'admin'),
        { barbeiros: adminSettings.barbeiros },
        { merge: true }
      );
    } catch (_) {}
  }
}

/* ════════════════════════════════════════════
   EXPOSIÇÃO GLOBAL (onclick handlers no HTML)
════════════════════════════════════════════ */
window.renderPortfolioAdmin       = renderPortfolioAdmin;
window.adicionarFotoPortfolio     = adicionarFotoPortfolio;
window.removerFotoPortfolio       = removerFotoPortfolio;
window.triggerUploadFoto          = triggerUploadFoto;
window.onPortFileChange           = onPortFileChange;
window.toggleDestaquePortfolio    = toggleDestaquePortfolio;
window.atualizarLimitePortfolio   = atualizarLimitePortfolio;
window.abrirEditarTagsFoto        = abrirEditarTagsFoto;
window.toggleTagChip              = toggleTagChip;
window.confirmarEditarTags        = confirmarEditarTags;
window.fecharEditarTags           = fecharEditarTags;
window.galeAdmDragStart           = galeAdmDragStart;
window.galeAdmDragOver            = galeAdmDragOver;
window.galeAdmDrop                = galeAdmDrop;
window.galeAdmDragEnd             = galeAdmDragEnd;

window.abrirGaleriaBarbeiro       = abrirGaleriaBarbeiro;
window.fecharGaleria              = fecharGaleria;
window.galeSetTag                 = galeSetTag;
window.abrirLightboxGaleria       = abrirLightboxGaleria;
window.fecharLightboxGaleria      = fecharLightboxGaleria;
window.navLightbox                = navLightbox;
window.lbTouchStart               = lbTouchStart;
window.lbTouchEnd                 = lbTouchEnd;
window.queroEsseCorte             = queroEsseCorte;
window.galeSetNota                = galeSetNota;
window.galeEnviarAvaliacao        = galeEnviarAvaliacao;
window.incrementarContadorCortes  = incrementarContadorCortes;
