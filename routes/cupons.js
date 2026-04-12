/* ══════════════════════════════════════════
   ROUTES/CUPONS.JS
   Validação de cupons e descontos
   Barbearia do Davi
══════════════════════════════════════════ */

/* ── Banco local de cupons (substituir por Firestore em produção) ── */
const CUPONS = [
  { codigo: 'BEMVINDO10', tipo: 'percentual', valor: 10, minimo: 0,   ativo: true, descricao: '10% de desconto' },
  { codigo: 'FIDELIDADE', tipo: 'fixo',       valor: 5,  minimo: 30,  ativo: true, descricao: 'R$ 5 de desconto' },
  { codigo: 'COMBO20',    tipo: 'percentual', valor: 20, minimo: 45,  ativo: true, descricao: '20% em combos' },
];

/* ── Valida e retorna um cupom ── */
export async function validarCupom(codigo, totalCarrinho) {
  if (!codigo) throw new Error('Informe um código de cupom.');

  // Busca no Firestore primeiro (se disponível)
  if (window._fb) {
    try {
      const { doc, getDoc, db } = window._fb;
      const snap = await getDoc(doc(db, 'cupons', codigo.toUpperCase()));
      if (snap.exists()) {
        const cupom = snap.data();
        return _aplicarCupom(cupom, totalCarrinho);
      }
    } catch (e) { /* usa banco local */ }
  }

  // Banco local
  const cupom = CUPONS.find(c => c.codigo === codigo.toUpperCase());
  if (!cupom) throw new Error('Cupom inválido ou expirado.');
  return _aplicarCupom(cupom, totalCarrinho);
}

function _aplicarCupom(cupom, total) {
  if (!cupom.ativo) throw new Error('Este cupom não está mais ativo.');
  if (cupom.minimo && total < cupom.minimo) {
    throw new Error(`Pedido mínimo de R$ ${cupom.minimo} para usar este cupom.`);
  }

  let desconto = 0;
  if (cupom.tipo === 'percentual') {
    desconto = Math.round(total * cupom.valor / 100 * 100) / 100;
  } else if (cupom.tipo === 'fixo') {
    desconto = Math.min(cupom.valor, total);
  }

  return {
    codigo:    cupom.codigo,
    descricao: cupom.descricao,
    desconto,
    totalFinal: Math.max(0, total - desconto),
  };
}

/* ── Salva novo cupom no Firestore (admin) ── */
export async function criarCupom(dados) {
  if (!window._fb) throw new Error('Firebase não disponível.');
  const { doc, setDoc, db } = window._fb;
  await setDoc(doc(db, 'cupons', dados.codigo.toUpperCase()), {
    ...dados,
    codigo: dados.codigo.toUpperCase(),
    criadoEm: new Date().toISOString(),
  });
}

/* ── Desativa cupom ── */
export async function desativarCupom(codigo) {
  if (!window._fb) throw new Error('Firebase não disponível.');
  const { doc, setDoc, db } = window._fb;
  await setDoc(doc(db, 'cupons', codigo.toUpperCase()), { ativo: false }, { merge: true });
}
