(() => {
  'use strict';
  const config = window.PARATY_AUTH_CONFIG;
  const base = new URL('./', location.href);
  const offlineKey = 'paratygps-offline-account';
  const api = {client: null, recovery: new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery'};
  window.ParatyAuth = api;
  api.url = page => new URL(page, base).href;
  api.storageKey = (id, name) => `paratygps-user:${id}:${name}`;
  api.roleLabel = user => user?.app_metadata?.role === 'master_admin' ? 'Administrador master' : 'Usuário';
  api.remember = (user, access) => {
    if (access?.status !== 'active') return;
    try { localStorage.setItem(offlineKey, JSON.stringify({id: user.id, email: user.email, verifiedAt: Date.now(), approved: true, isMaster: access.is_master === true})); } catch {}
  };
  api.offlineAccount = () => {
    try {
      const value = JSON.parse(localStorage.getItem(offlineKey));
      if (value && /^[0-9a-f-]{36}$/i.test(value.id) && typeof value.email === 'string' && value.approved === true && Number.isFinite(value.verifiedAt) && Date.now() >= value.verifiedAt && Date.now() - value.verifiedAt < 86400000) return value;
    } catch {}
    return null;
  };
  api.forgetApproval = () => { try { localStorage.removeItem(offlineKey); } catch {} };
  api.access = async () => {
    const {data, error} = await api.client.rpc('platform_access_status');
    if (error) throw error;
    if (!data || !['pending', 'active', 'suspended'].includes(data.status)) throw new Error('Invalid access response');
    return data;
  };
  api.clearSession = () => {
    try { localStorage.removeItem(offlineKey); localStorage.removeItem(config.storageKey); localStorage.removeItem(config.storageKey + '-code-verifier'); } catch {}
  };
  api.message = error => {
    const code = error?.code || '';
    if (code === 'invalid_credentials') return 'E-mail ou senha incorretos.';
    if (code === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar. Confira também a pasta de spam.';
    if (code.includes('rate_limit') || error?.status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    if (code === 'weak_password') return 'Use uma senha mais forte, com letras, números e símbolos.';
    if (code === 'signup_disabled') return 'O cadastro está temporariamente indisponível.';
    if (code === 'email_address_not_authorized' || code === 'unexpected_failure') return 'Não foi possível enviar a confirmação. Tente novamente mais tarde ou fale com o administrador.';
    if (code === 'provider_disabled' || code === 'validation_failed') return 'O acesso com Google está indisponível no momento. Entre com e-mail e senha.';
    if (!navigator.onLine || /fetch|network|timeout/i.test(error?.message || '')) return 'Não foi possível conectar. Confira sua internet e tente novamente.';
    return 'Não foi possível concluir. Confira os dados e tente novamente.';
  };
  if (!config || !window.supabase) return;
  api.client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: {flowType: 'pkce', storageKey: config.storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true},
    global: {fetch: (input, options = {}) => fetch(input, {...options, signal: options.signal || AbortSignal.timeout(15000)})}
  });
  api.client.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') api.recovery = true; });
})();
