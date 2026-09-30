(async () => {
  'use strict';
  const $ = id => document.getElementById(id), auth = window.ParatyAuth;
  let mode = 'login', busy = false;
  const say = (value, error = false) => { $('authMessage').textContent = value; $('authMessage').classList.toggle('error', error); };
  function setMode(next) {
    mode = next;
    $('authTitle').textContent = {login: 'Entre na sua conta', signup: 'Crie sua conta', recover: 'Recupere seu acesso', reset: 'Escolha uma nova senha'}[mode];
    $('authDescription').textContent = {login: 'Seus pontos e percursos esperam por você.', signup: 'Comece a registrar suas saídas pela baía.', recover: 'Vamos enviar um link para o seu e-mail.', reset: 'Use uma senha que só você conheça.'}[mode];
    const signup = mode === 'signup', password = mode !== 'recover', email = mode !== 'reset';
    $('nameField').hidden = !signup; $('fullName').required = signup;
    $('emailField').hidden = !email; $('email').required = email;
    $('passwordField').hidden = !password; $('password').required = password;
    $('password').minLength = mode === 'login' ? 1 : 8;
    $('password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('passwordHint').hidden = mode === 'login' || !password;
    $('confirmField').hidden = !(signup || mode === 'reset'); $('confirmPassword').required = signup || mode === 'reset';
    $('submitBtn').textContent = {login: 'Entrar', signup: 'Criar minha conta', recover: 'Enviar link de recuperação', reset: 'Salvar nova senha'}[mode];
    $('forgotBtn').hidden = mode !== 'login'; $('backBtn').hidden = mode === 'login' || mode === 'signup';
    document.querySelector('.tabs').hidden = mode === 'recover' || mode === 'reset';
    $('googleBtn').hidden = mode === 'recover' || mode === 'reset';
    document.querySelector('.separator').hidden = mode === 'recover' || mode === 'reset';
    $('loginTab').setAttribute('aria-selected', String(mode === 'login'));
    $('signupTab').setAttribute('aria-selected', String(signup));
    $('password').value = $('confirmPassword').value = ''; say('');
  }
  const setBusy = value => {
    busy = value; $('authForm').setAttribute('aria-busy', String(value));
    for (const id of ['submitBtn', 'googleBtn', 'loginTab', 'signupTab', 'forgotBtn', 'backBtn']) $(id).disabled = value;
  };
  $('loginTab').onclick = () => setMode('login'); $('signupTab').onclick = () => setMode('signup');
  $('forgotBtn').onclick = () => setMode('recover'); $('backBtn').onclick = () => setMode('login');
  $('showPassword').onclick = () => {
    const show = $('password').type === 'password'; $('password').type = show ? 'text' : 'password';
    $('showPassword').textContent = show ? 'Ocultar' : 'Mostrar';
    $('showPassword').setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha'); $('showPassword').setAttribute('aria-pressed', String(show));
  };
  $('offlineBtn').onclick = () => location.assign(auth.url('index.html'));
  if (!auth?.client) { setBusy(true); say('Não foi possível carregar o acesso. Recarregue a página.', true); return; }
  $('offlineBtn').hidden = navigator.onLine || !auth.offlineAccount();
  window.addEventListener('online', () => { $('offlineBtn').hidden = true; });
  window.addEventListener('offline', () => { $('offlineBtn').hidden = !auth.offlineAccount(); });
  auth.client.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') setMode('reset'); });
  $('googleBtn').onclick = async () => {
    if (busy) return; setBusy(true); say('Conectando ao Google…');
    try {
      const settings = await fetch(window.PARATY_AUTH_CONFIG.url + '/auth/v1/settings', {headers: {apikey: window.PARATY_AUTH_CONFIG.publishableKey}, signal: AbortSignal.timeout(10000)});
      if (!settings.ok || !(await settings.json()).external?.google) {
        say('O acesso com Google está indisponível no momento. Entre com e-mail e senha.', true); return;
      }
      const {data, error} = await auth.client.auth.signInWithOAuth({provider: 'google', options: {redirectTo: auth.url('login.html'), skipBrowserRedirect: true, queryParams: {prompt: 'select_account'}}});
      if (error) throw error;
      if (!data.url || new URL(data.url).origin !== new URL(window.PARATY_AUTH_CONFIG.url).origin) throw new Error('Invalid redirect');
      location.assign(data.url);
    } catch (error) { say(auth.message(error), true); } finally { setBusy(false); }
  };
  $('authForm').onsubmit = async event => {
    event.preventDefault(); if (busy || !$('authForm').reportValidity()) return;
    const email = $('email').value.trim().toLowerCase(), password = $('password').value;
    if ((mode === 'signup' || mode === 'reset') && password !== $('confirmPassword').value) { say('As senhas precisam ser iguais.', true); $('confirmPassword').focus(); return; }
    setBusy(true); say('Aguarde um instante…');
    try {
      if (mode === 'login') {
        const {data, error} = await auth.client.auth.signInWithPassword({email, password}); if (error) throw error;
        if (!data.user || !data.session) throw new Error('No session');
        auth.remember(data.user); location.replace(auth.url('index.html')); return;
      }
      if (mode === 'signup') {
        const {data, error} = await auth.client.auth.signUp({email, password, options: {emailRedirectTo: auth.url('login.html'), data: {full_name: $('fullName').value.trim().slice(0, 60)}}}); if (error) throw error;
        $('password').value = $('confirmPassword').value = '';
        if (data.session && data.user) { auth.remember(data.user); location.replace(auth.url('index.html')); return; }
        say('Confira seu e-mail para confirmar o cadastro. Se a conta já existir, use “Entrar” ou recupere sua senha.'); return;
      }
      if (mode === 'recover') {
        const {error} = await auth.client.auth.resetPasswordForEmail(email, {redirectTo: auth.url('login.html')}); if (error) throw error;
        say('Se houver uma conta com esse e-mail, você receberá o link de recuperação.'); return;
      }
      if (mode === 'reset') {
        const {error} = await auth.client.auth.updateUser({password}); if (error) throw error;
        auth.recovery = false; setMode('login'); say('Senha atualizada. Entre com sua nova senha.');
        await auth.client.auth.signOut({scope: 'local'}); auth.clearSession();
      }
    } catch (error) { say(auth.message(error), true); } finally { setBusy(false); }
  };
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  // SDK owns the PKCE exchange. Do not exchange the same code twice.
  try {
    const {data, error} = await auth.client.auth.getSession(); if (error) throw error;
    if (auth.recovery) { setMode('reset'); return; }
    if (new URL(location.href).searchParams.has('error') || new URLSearchParams(location.hash.slice(1)).has('error')) {
      say('Não foi possível concluir o acesso. Tente entrar novamente.', true); history.replaceState(null, '', auth.url('login.html')); return;
    }
    if (data.session && navigator.onLine) {
      const {data: verified, error: verifyError} = await auth.client.auth.getUser();
      if (!verifyError && verified.user) { auth.remember(verified.user); location.replace(auth.url('index.html')); }
    }
  } catch (error) { say(auth.message(error), true); }
})();
