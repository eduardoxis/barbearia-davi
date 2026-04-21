/* ══════════════════════════════════════════
   LOGIN.JS — Modal de login/cadastro/recuperação
   Barbearia do Davi
══════════════════════════════════════════ */

import { showToast, togglePass, updateNavUserFb } from './global.js';
import { fazerLogin, fazerCadastro, fazerLogout, gerarCodigo, redefinirSenha } from '../routes/auth.js';

/* ── Estado de recuperação de senha ── */
let resetCode = '';
let resetEmail = '';
let resetChannel = '';
let codeTimerInt = null;

/* ── Abre/fecha modal ── */
export function openUserModal() {
  document.getElementById('userModal').classList.add('show');
  if (window.fbUser?.isBarbeiro) { showBarbeiroView(); return; }
  if (window.fbUser) showLoggedView();
  else showLoginView();
}

export function closeUserModal() {
  document.getElementById('userModal').classList.remove('show');
}

/* ── View do barbeiro logado ── */
function showBarbeiroView() {
  const modal = document.getElementById('userModal');
  if (!modal) return;

  // Reutiliza o modal com conteúdo customizado para barbeiro
  const loginReg = document.getElementById('modalLoginRegister');
  const loggedIn  = document.getElementById('loggedInView');
  if (loginReg) loginReg.style.display = 'none';
  if (loggedIn)  loggedIn.style.display = 'none';

  // Remove view anterior de barbeiro se existir
  let bv = document.getElementById('barbeiroModalView');
  if (!bv) {
    bv = document.createElement('div');
    bv.id = 'barbeiroModalView';
    bv.style.cssText = 'padding:1.5rem;display:flex;flex-direction:column;align-items:center;gap:1rem;text-align:center';
    const box = modal.querySelector('.modal') || modal.firstElementChild;
    if (box) box.appendChild(bv); else modal.appendChild(bv);
  }

  const nome = window.fbUser?.name || 'Barbeiro';
  const email = window.fbUser?.email || '';
  const inicial = nome.charAt(0).toUpperCase();
  bv.innerHTML = \`
    <div style="width:56px;height:56px;border-radius:50%;background:rgba(111,207,151,0.15);
      border:2px solid #6FCF97;display:flex;align-items:center;justify-content:center;
      font-size:1.5rem;font-weight:700;color:#6FCF97;font-family:'Bebas Neue',sans-serif">
      \${inicial}
    </div>
    <div>
      <div style="font-family:'Oswald',sans-serif;font-size:1rem;font-weight:700;
        color:var(--white);letter-spacing:0.05em;text-transform:uppercase">\${nome}</div>
      <div style="font-size:0.72rem;color:var(--gray);margin-top:0.2rem">\${email}</div>
      <div style="font-size:0.65rem;color:#6FCF97;margin-top:0.15rem;letter-spacing:0.08em">💈 BARBEIRO</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:0.6rem;width:100%;max-width:240px">
      <button onclick="closeUserModal();window.location.href='pages/painel.html'"
        style="width:100%;padding:0.65rem;background:#6FCF97;color:#0D0D0D;border:none;
        border-radius:3px;font-weight:700;font-size:0.78rem;letter-spacing:0.1em;
        text-transform:uppercase;cursor:pointer;font-family:'Inter',sans-serif">
        💈 MEU PAINEL
      </button>
      <button onclick="closeUserModal();fbLogout()"
        style="width:100%;padding:0.65rem;background:transparent;
        border:1px solid var(--border);color:var(--gray);border-radius:3px;
        font-weight:700;font-size:0.78rem;letter-spacing:0.1em;
        text-transform:uppercase;cursor:pointer;font-family:'Inter',sans-serif">
        SAIR DA CONTA ✕
      </button>
    </div>
  \`;
  bv.style.display = 'flex';
}

function showLoginView() {
  document.getElementById('modalLoginRegister').style.display = 'block';
  document.getElementById('loggedInView').style.display = 'none';
  switchTab('login');
}

export function showLoggedView() {
  document.getElementById('modalLoginRegister').style.display = 'none';
  document.getElementById('loggedInView').style.display = 'block';
  if (!window.fbUser) return;

  // Barbeiro tem view própria
  if (window.fbUser.isBarbeiro) { showBarbeiroView(); return; }

  const parts = window.fbUser.name.split(' ');
  const initials = (parts[0][0] + (parts.length > 1 ? parts[parts.length-1][0] : '')).toUpperCase();
  document.getElementById('userAvatarModal').textContent = initials;
  document.getElementById('loggedModalName').textContent = window.fbUser.name;
  document.getElementById('loggedModalEmail').textContent = window.fbUser.email;
  import('./historico.js').then(m => m.carregarHistoricoCliente());
}

/* ── Tabs login/cadastro ── */
export function switchTab(tab) {
  const forms = ['loginForm','registerForm','forgotForm','forgotCodeForm','forgotNewPass'];
  forms.forEach(f => { const el = document.getElementById(f); if (el) el.style.display = 'none'; });
  document.getElementById('tabLogin')?.classList.toggle('active', tab === 'login');
  document.getElementById('tabRegister')?.classList.toggle('active', tab === 'register');
  if (tab === 'login')       document.getElementById('loginForm').style.display = 'flex';
  else if (tab === 'register') document.getElementById('registerForm').style.display = 'flex';
  else if (tab === 'forgot')   document.getElementById('forgotForm').style.display = 'flex';
  else if (tab === 'forgotCode') document.getElementById('forgotCodeForm').style.display = 'flex';
  else if (tab === 'newPass')  document.getElementById('forgotNewPass').style.display = 'flex';
}

/* ── Efetua login ── */
export async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginErr');
  errEl.classList.remove('show');
  try {
    const res = await fazerLogin(email, pass);
    updateNavUserFb();
    // Barbeiro: apenas mostra o botão "Meu Painel" no drawer, sem redirecionar
    if (res.role === 'barbeiro') {
      closeUserModal();
      showToast('💈 Bem-vindo, ' + res.barbeiro.nome + '! Clique em "Meu Painel" para ver sua agenda.');
      return;
    }
    fillLoggedFields();
    closeUserModal();
    showToast('✓ Bem-vindo, ' + window.fbUser?.name?.split(' ')[0] + '!');
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.add('show');
  }
}

/* ── Efetua cadastro ── */
export async function doRegister() {
  const errEl = document.getElementById('regErr');
  errEl.classList.remove('show');
  try {
    await fazerCadastro({
      name:  document.getElementById('regName').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      phone: document.getElementById('regPhone').value.trim(),
      pass:  document.getElementById('regPass').value,
      pass2: document.getElementById('regPass2').value,
    });
    updateNavUserFb();
    fillLoggedFields();
    closeUserModal();
    showToast('✓ Conta criada! Bem-vindo, ' + window.fbUser?.name?.split(' ')[0] + '!');
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.add('show');
  }
}

/* ── Logout ── */
export async function doLogout() {
  await fazerLogout();
  clearLoggedFields();
  closeUserModal();
}

/* ── Campos de usuário logado no formulário de agendamento ── */
export function fillLoggedFields() {
  if (!window.fbUser) return;
  document.getElementById('loggedUserInfo').style.display = 'block';
  document.getElementById('guestFields').style.display = 'none';
  document.getElementById('loggedUserName').textContent = window.fbUser.name;
  document.getElementById('loggedUserEmail').textContent = window.fbUser.email;
  document.getElementById('step1Next').disabled = false;
}

export function clearLoggedFields() {
  document.getElementById('loggedUserInfo').style.display = 'none';
  document.getElementById('guestFields').style.display = 'block';
  document.getElementById('step1Next').disabled = true;
}

/* ── Recuperação de senha ── */
export function selectResetChannel(ch) {
  resetChannel = ch;
  const styleOn  = { borderColor: 'var(--red)', color: 'var(--red)' };
  const styleOff = { borderColor: 'var(--border)', color: 'var(--gray)' };
  Object.assign(document.getElementById('chEmail').style, ch === 'email' ? styleOn : styleOff);
  Object.assign(document.getElementById('chPhone').style, ch === 'phone' ? styleOn : styleOff);
  document.getElementById('sendCodeBtn').disabled = false;
}

export function sendResetCode(resend = false) {
  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) { document.getElementById('forgotErr').classList.add('show'); return; }
  document.getElementById('forgotErr').classList.remove('show');
  resetEmail = email;
  resetCode = gerarCodigo();
  document.getElementById('generatedCode').textContent = resetCode;
  const via = resetChannel === 'phone' ? '📱 WhatsApp' : '📧 e-mail';
  document.getElementById('codeDeliveryMsg').textContent = `Código ${resend ? 'reenviado' : 'enviado'} via ${via} (demo)`;
  document.querySelectorAll('.code-box').forEach(b => { b.value = ''; b.classList.remove('filled','error-box'); });
  document.getElementById('codeErr').classList.remove('show');
  document.getElementById('verifyBtn').disabled = true;
  clearInterval(codeTimerInt);
  let sec = 600;
  codeTimerInt = setInterval(() => {
    const m = Math.floor(sec/60).toString().padStart(2,'0');
    const s = (sec%60).toString().padStart(2,'0');
    const el = document.getElementById('codeTimer');
    if (el) { el.textContent = m+':'+s; el.style.color = sec <= 60 ? '#ff4444' : 'var(--red)'; }
    if (sec-- <= 0) { clearInterval(codeTimerInt); resetCode = ''; showToast('⏰ Código expirado.'); }
  }, 1000);
  switchTab('forgotCode');
  setTimeout(() => document.querySelectorAll('.code-box')[0]?.focus(), 100);
  showToast(resend ? '🔁 Novo código gerado!' : '✓ Código gerado!');
}

export function codeIn(el, idx) {
  el.value = el.value.replace(/\D/g, '').slice(-1);
  el.classList.toggle('filled', el.value !== '');
  el.classList.remove('error-box');
  if (el.value && idx < 5) document.querySelectorAll('.code-box')[idx+1].focus();
  checkCodeDone();
}

export function codeKey(e, idx) {
  if (e.key === 'Backspace') {
    const bs = document.querySelectorAll('.code-box');
    if (!bs[idx].value && idx > 0) { bs[idx-1].value = ''; bs[idx-1].classList.remove('filled'); bs[idx-1].focus(); checkCodeDone(); }
  }
}

function checkCodeDone() {
  const v = [...document.querySelectorAll('.code-box')].map(b => b.value).join('');
  document.getElementById('verifyBtn').disabled = v.length < 6;
}

export function verifyCode() {
  const entered = [...document.querySelectorAll('.code-box')].map(b => b.value).join('');
  if (entered !== resetCode) {
    document.getElementById('codeErr').classList.add('show');
    document.querySelectorAll('.code-box').forEach(b => { b.classList.add('error-box'); setTimeout(() => b.classList.remove('error-box'), 400); });
    return;
  }
  clearInterval(codeTimerInt);
  document.getElementById('codeErr').classList.remove('show');
  document.getElementById('newPass1').value = '';
  document.getElementById('newPass2').value = '';
  document.getElementById('newPassErr').classList.remove('show');
  document.getElementById('savePassBtn').disabled = true;
  document.getElementById('newStrengthFill').style.width = '0%';
  document.getElementById('newStrengthLabel').textContent = '';
  switchTab('newPass');
  showToast('✅ Código verificado!');
}

export function checkNewPass() {
  const p1 = document.getElementById('newPass1').value;
  const p2 = document.getElementById('newPass2').value;
  let s = 0;
  if (p1.length >= 6) s++;
  if (p1.length >= 10) s++;
  if (/[A-Z]/.test(p1)) s++;
  if (/[0-9]/.test(p1)) s++;
  if (/[^A-Za-z0-9]/.test(p1)) s++;
  const cols = ['','#E02020','#E07820','#E0C020','#6FCF97','#27AE60'];
  const lbls = ['','Muito fraca','Fraca','Média','Forte','Muito forte'];
  const fill = document.getElementById('newStrengthFill');
  const lbl  = document.getElementById('newStrengthLabel');
  if (fill) { fill.style.width = (s*20) + '%'; fill.style.background = cols[s] || 'transparent'; }
  if (lbl)  { lbl.textContent = p1.length > 0 ? lbls[s] : ''; lbl.style.color = cols[s] || 'var(--gray)'; }
  const err = document.getElementById('newPassErr');
  const match = p1 && p2 && p1 === p2;
  if (p2 && !match) { err.textContent = 'As senhas não coincidem.'; err.classList.add('show'); }
  else if (p1 && p1.length < 6) { err.textContent = 'Mínimo 6 caracteres.'; err.classList.add('show'); }
  else { err.classList.remove('show'); }
  document.getElementById('savePassBtn').disabled = !(match && p1.length >= 6);
}

export async function saveNewPassword() {
  const nova = document.getElementById('newPass1').value;
  await redefinirSenha(resetEmail, nova);
  resetCode = ''; resetEmail = ''; resetChannel = '';
  switchTab('login');
  document.getElementById('loginEmail').value = resetEmail;
}

/* ── Check força de senha no cadastro ── */
export function checkPassStrength(val) {
  let s = 0;
  if (val.length >= 6) s++;
  if (val.length >= 10) s++;
  if (/[A-Z]/.test(val)) s++;
  if (/[0-9]/.test(val)) s++;
  if (/[^A-Za-z0-9]/.test(val)) s++;
  const cols = ['','#E02020','#E07820','#E0C020','#6FCF97','#27AE60'];
  const lbls = ['','Muito fraca','Fraca','Média','Forte','Muito forte'];
  document.getElementById('strengthFill').style.width = (s*20) + '%';
  document.getElementById('strengthFill').style.background = cols[s] || 'transparent';
  document.getElementById('strengthLabel').textContent = val.length > 0 ? lbls[s] : '';
  document.getElementById('strengthLabel').style.color = cols[s] || 'var(--gray)';
}

/* ── Expõe funções globais para onclick no HTML ── */
window.openUserModal  = openUserModal;
window.closeUserModal = closeUserModal;
window.switchTab      = switchTab;
window.doLogin        = doLogin;
window.doRegister     = doRegister;
window.doLogout       = doLogout;
window.fbLogout       = doLogout;
window.selectResetChannel = selectResetChannel;
window.sendResetCode  = sendResetCode;
window.codeIn         = codeIn;
window.codeKey        = codeKey;
window.verifyCode     = verifyCode;
window.checkNewPass   = checkNewPass;
window.saveNewPassword = saveNewPassword;
window.checkPassStrength = checkPassStrength;
