/* ══════════════════════════════════════════
   ROUTES/AUTH.JS — Autenticação
   Login, cadastro, logout, recuperação de senha
   Barbearia do Davi
══════════════════════════════════════════ */

import { showToast, updateNavUserFb, hideAdminNavBtn } from '../js/global.js';

/* ── LocalStorage helpers (fallback sem Firebase) ── */
export function getLocalUsers() {
  try { return JSON.parse(localStorage.getItem('bbdavi_users') || '[]'); }
  catch (e) { return []; }
}

export function saveLocalUsers(users) {
  localStorage.setItem('bbdavi_users', JSON.stringify(users));
}

/* ── Login ── */
export async function fazerLogin(email, pass) {
  if (!email || !pass) throw new Error('Preencha e-mail e senha.');

  // Admin hardcoded (redireciona para painel)
  if (email === 'davibarber@gmail.com' && pass === 'davi4452') {
    return { role: 'admin' };
  }

  // Verifica se é um barbeiro cadastrado — busca do Firestore para garantir dados atualizados
  try {
    if (window._fb) {
      const snap = await window._fb.getDoc(
        window._fb.doc(window._fb.db, 'settings', 'admin')
      );
      if (snap.exists()) {
        const barbeiros = snap.data().barbeiros || [];
        const barbMatch = barbeiros.find(
          b => b.email && b.senha && b.email === email && b.senha === pass && b.ativo !== false
        );
        if (barbMatch) {
          window.fbUser = {
            uid:        'barb_' + barbMatch.id,
            email,
            name:       barbMatch.nome,
            isBarbeiro: true,
            barbeiroId: barbMatch.id,
          };
          window._barbeiroPainel = barbMatch;

          // Salva credenciais na sessão para o painel usar no Firestore Auth
          try {
            localStorage.setItem('_bbcred', btoa(unescape(encodeURIComponent(JSON.stringify({ e: email, p: pass, t: Date.now() })))));  // temp, removido no logout
          } catch (_) {}

          // Tenta criar/entrar na conta Firebase Auth para que as regras do Firestore funcionem
          if (window._fb?.signInWithEmailAndPassword) {
            try {
              await window._fb.signInWithEmailAndPassword(window._fb.auth, email, pass);
            } catch (authErr) {
              if (
                authErr.code === 'auth/user-not-found' ||
                authErr.code === 'auth/invalid-credential' ||
                authErr.code === 'auth/invalid-login-credentials'
              ) {
                try {
                  await window._fb.createUserWithEmailAndPassword(window._fb.auth, email, pass);
                } catch (_) {}
              }
            }
          }

          updateNavUserFb();
          return { role: 'barbeiro', barbeiro: barbMatch };
        }
      }
    }
  } catch (e) {
    console.warn('Painel: erro ao verificar barbeiro no Firestore', e);
  }

  // Firebase (se configurado)
  if (window._fb && window._fb.auth.app?.options?.apiKey !== 'COLE_SUA_API_KEY_AQUI') {
    try {
      await window._fb.signInWithEmailAndPassword(window._fb.auth, email, pass);
      return { role: 'user' };
    } catch (e) {
      // Cai para login local
    }
  }

  // Login local (localStorage)
  const users = getLocalUsers();
  const user = users.find(u => u.email === email && u.pass === pass);
  if (!user) throw new Error('E-mail ou senha incorretos.');

  window.fbUser = { uid: 'local_' + email, email, name: user.name, phone: user.phone || '', isAdmin: false };
  updateNavUserFb();
  return { role: 'user', user };
}

/* ── Cadastro ── */
export async function fazerCadastro({ name, email, phone, pass, pass2 }) {
  if (!name || !email || !pass) throw new Error('Preencha todos os campos obrigatórios.');
  if (pass !== pass2) throw new Error('As senhas não coincidem.');
  if (pass.length < 6) throw new Error('A senha precisa ter no mínimo 6 caracteres.');

  // Firebase
  if (window._fb && window._fb.auth.app?.options?.apiKey !== 'COLE_SUA_API_KEY_AQUI') {
    try {
      const cred = await window._fb.createUserWithEmailAndPassword(window._fb.auth, email, pass);
      await window._fb.updateProfile(cred.user, { displayName: name });
      await window._fb.setDoc(window._fb.doc(window._fb.db, 'users', cred.user.uid), {
        name, email, phone, isAdmin: false, createdAt: new Date().toISOString()
      });
      return { uid: cred.user.uid };
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') throw new Error('Este e-mail já está cadastrado.');
      // Tenta local como fallback
    }
  }

  // Local
  const users = getLocalUsers();
  if (users.find(u => u.email === email)) throw new Error('Este e-mail já está cadastrado.');
  users.push({ name, email, phone, pass, history: [] });
  saveLocalUsers(users);

  window.fbUser = { uid: 'local_' + Date.now(), email, name, phone, isAdmin: false };
  updateNavUserFb();
  return { uid: window.fbUser.uid };
}

/* ── Logout ── */
export async function fazerLogout() {
  if (window._fb?.auth?.currentUser) await window._fb.signOut(window._fb.auth);
  window.fbUser = null;
  window._barbeiroPainel = null;
  try { localStorage.removeItem('bbdavi_barbeiro'); localStorage.removeItem('_bbcred'); } catch (_) {}
  updateNavUserFb();
  showToast('Você saiu da conta.');
}

/* ── Recuperação de senha ── */
const usedCodes = new Set();

export function gerarCodigo() {
  let c;
  do { c = String(Math.floor(100000 + Math.random() * 900000)); } while (usedCodes.has(c));
  usedCodes.add(c);
  return c;
}

export async function enviarCodigoRecuperacao(email, canal) {
  // Em produção: chama API de e-mail/WhatsApp
  // Em demo: só gera o código
  const code = gerarCodigo();
  return { code, via: canal === 'phone' ? '📱 WhatsApp' : '📧 e-mail' };
}

export async function redefinirSenha(email, novaSenha) {
  if (window._fb?.auth) {
    // Em produção usaria confirmPasswordReset
    // Por ora, atualiza no localStorage
  }
  const users = getLocalUsers();
  const idx = users.findIndex(u => u.email === email);
  if (idx >= 0) { users[idx].pass = novaSenha; saveLocalUsers(users); }
  showToast('🔐 Senha atualizada!');
}
