(async () => {
  'use strict';
  const auth = window.ParatyAuth, $ = id => document.getElementById(id);
  const login = () => location.replace(auth.url('login.html'));
  if (!auth?.client) { $('accessMessage').textContent = 'Recarregue a página para tentar novamente.'; return; }
  $('logoutBtn').onclick = async () => { try { await auth.client.auth.signOut({scope:'local'}); } finally { auth.clearSession(); login(); } };
  const check = async () => {
    $('checkBtn').disabled = true;
    try {
      const {data,error} = await auth.client.auth.getUser();
      if (error) { if (error.status === 401 || error.status === 403) { auth.clearSession(); login(); return; } throw error; }
      if (!data.user) { login(); return; }
      $('accessEmail').textContent = data.user.email;
      const access = await auth.access();
      if (access.status === 'active') { location.replace(auth.url('index.html')); return; }
      auth.forgetApproval();
      $('accessTitle').textContent = access.status === 'suspended' ? 'Acesso suspenso' : 'Aguardando liberação';
      $('accessMessage').textContent = access.status === 'suspended' ? 'Seu acesso está suspenso. Fale com a revenda para regularizar e solicitar uma nova liberação.' : 'Seu cadastro foi recebido. O administrador master precisa liberar sua conta antes de você usar o sistema.';
    } catch { $('accessTitle').textContent = 'Verificação necessária'; $('accessMessage').textContent = 'Conecte-se à internet para consultar a liberação. Se já estava liberado, o prazo offline pode ter expirado.'; }
    finally { $('checkBtn').disabled = false; }
  };
  $('checkBtn').onclick = check;
  window.addEventListener('online', check);
  await check();
})();
