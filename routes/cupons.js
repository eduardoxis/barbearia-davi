/* ══════════════════════════════════════════
   ROUTES/CUPONS.JS
   CRUD completo de cupons + validação no checkout
   Barbearia do Davi
══════════════════════════════════════════ */

/* ── Valida e aplica cupom (checkout) ─────────────────────────── */
export async function validarCupom(codigo, totalCarrinho) {
  if (!codigo) throw new Error('Informe um código de cupom.');
  if (!window._fb) throw new Error('Firebase não disponível.');

  const { doc, getDoc, db } = window._fb;
  const snap = await getDoc(doc(db, 'cupons', codigo.toUpperCase()));
  if (!snap.exists()) throw new Error('Cupom inválido ou inexistente.');

  const cupom = snap.data();
  return _aplicarCupom(cupom, totalCarrinho);
}

function _aplicarCupom(cupom, total) {
  if (!cupom.ativo) throw new Error('Este cupom não está mais ativo.');

  if (cupom.dataExpiracao) {
    const exp = new Date(cupom.dataExpiracao);
    exp.setHours(23, 59, 59, 999);
    if (new Date() > exp) throw new Error('Este cupom expirou.');
  }

  if (cupom.maxUsos && cupom.usosFeitos >= cupom.maxUsos) {
    throw new Error('Este cupom atingiu o limite de usos.');
  }

  let desconto = 0;
  if (cupom.tipo === 'percentual') {
    desconto = Math.round(total * cupom.valor / 100 * 100) / 100;
  } else if (cupom.tipo === 'fixo') {
    desconto = Math.min(cupom.valor, total);
  }

  return {
    codigo:     cupom.codigo,
    descricao:  cupom.descricao || '',
    tipo:       cupom.tipo,
    valor:      cupom.valor,
    desconto,
    totalFinal: Math.max(0, total - desconto),
  };
}

/* ── Incrementa usos após pagamento confirmado ────────────────── */
export async function registrarUsoCupom(codigo) {
  if (!codigo || !window._fb) return;
  const { doc, getDoc, updateDoc, db } = window._fb;
  try {
    const ref  = doc(db, 'cupons', codigo.toUpperCase());
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const cupom    = snap.data();
    const novoUso  = (cupom.usosFeitos || 0) + 1;
    const updates  = { usosFeitos: novoUso };
    if (cupom.maxUsos && novoUso >= cupom.maxUsos) updates.ativo = false;
    await updateDoc(ref, updates);
  } catch (e) { console.warn('[cupom] Erro ao registrar uso:', e); }
}

/* ── Busca todos os cupons (admin) ───────────────────────────── */
export async function buscarTodosCupons() {
  if (!window._fb) return [];
  const { collection, getDocs, db } = window._fb;
  try {
    const snap = await getDocs(collection(db, 'cupons'));
    const lista = [];
    snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
    return lista.sort((a, b) => (b.criadoEm || '') > (a.criadoEm || '') ? 1 : -1);
  } catch (e) { return []; }
}

/* ── Cria cupom (admin) ──────────────────────────────────────── */
export async function criarCupom(dados) {
  if (!window._fb) throw new Error('Firebase não disponível.');
  const { doc, setDoc, getDoc, db } = window._fb;

  const codigo = dados.codigo.toUpperCase().replace(/\s/g, '');
  if (!codigo) throw new Error('Informe o código do cupom.');

  const ref  = doc(db, 'cupons', codigo);
  const snap = await getDoc(ref);
  if (snap.exists()) throw new Error('Código "' + codigo + '" já existe.');

  const cupom = {
    codigo,
    tipo:          dados.tipo || 'percentual',
    valor:         Number(dados.valor) || 0,
    descricao:     dados.descricao || '',
    dataExpiracao: dados.dataExpiracao || null,
    maxUsos:       dados.maxUsos ? Number(dados.maxUsos) : null,
    usosFeitos:    0,
    ativo:         dados.ativo !== false,
    criadoEm:      new Date().toISOString(),
  };

  await setDoc(ref, cupom);
  return cupom;
}

/* ── Edita cupom (admin) ─────────────────────────────────────── */
export async function editarCupom(codigo, dados) {
  if (!window._fb) throw new Error('Firebase não disponível.');
  const { doc, updateDoc, db } = window._fb;

  await updateDoc(doc(db, 'cupons', codigo.toUpperCase()), {
    tipo:          dados.tipo,
    valor:         Number(dados.valor),
    descricao:     dados.descricao || '',
    dataExpiracao: dados.dataExpiracao || null,
    maxUsos:       dados.maxUsos ? Number(dados.maxUsos) : null,
    ativo:         !!dados.ativo,
    atualizadoEm:  new Date().toISOString(),
  });
}

/* ── Alterna ativo/inativo (admin) ───────────────────────────── */
export async function toggleCupom(codigo, ativo) {
  if (!window._fb) throw new Error('Firebase não disponível.');
  const { doc, updateDoc, db } = window._fb;
  await updateDoc(doc(db, 'cupons', codigo.toUpperCase()), { ativo: !!ativo });
}

/* ── Exclui cupom (admin) ────────────────────────────────────── */
export async function excluirCupom(codigo) {
  if (!window._fb) throw new Error('Firebase não disponível.');
  const { doc, deleteDoc, db } = window._fb;
  await deleteDoc(doc(db, 'cupons', codigo.toUpperCase()));
}
