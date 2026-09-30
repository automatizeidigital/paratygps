(async () => {
  'use strict';
  const auth = window.ParatyAuth;
  const status = document.getElementById('authLoading');
  const redirect = () => location.replace(auth.url('login.html'));
  if (!auth?.client) { status.textContent = 'Não foi possível carregar o acesso. Recarregue a página.'; return; }
  let user, offline = !navigator.onLine;
  try {
    if (offline) user = auth.offlineAccount();
    else {
      const {data, error} = await auth.client.auth.getUser();
      if (error) {
        // Only transport failures may fall back to local-only data. An invalid
        // or revoked session must return to login, even with a remembered ID.
        const transport = !error.status || error.status >= 500;
        if (transport && auth.offlineAccount()) { user = auth.offlineAccount(); offline = true; }
        else { auth.clearSession(); redirect(); return; }
      } else user = data.user;
    }
    if (!user) { redirect(); return; }
    if (!offline) auth.remember(user);
    window.paratyStorageKey = name => auth.storageKey(user.id, name);
    window.paratyCurrentUser = {id: user.id, email: user.email, offline};
    if (!offline && user.app_metadata?.role === 'master_admin') {
      // The existing installation belongs to the master. Preserve its local
      // data on first authenticated use, without assigning it to new users.
      for (const name of ['paraty-nautica-v1', 'paratygps-route-v1', 'paratygps-history-v1']) {
        try {
          const key = window.paratyStorageKey(name), previous = localStorage.getItem(name);
          if (previous !== null && localStorage.getItem(key) === null) {
            localStorage.setItem(key, previous); localStorage.removeItem(name);
          }
        } catch {}
      }
    }
    document.getElementById('accountEmail').textContent = user.email;
    document.getElementById('accountRole').textContent = offline ? 'Offline · dados deste aparelho' : auth.roleLabel(user);
    document.getElementById('logoutBtn').onclick = async () => {
      document.getElementById('logoutBtn').disabled = true;
      try { if (navigator.onLine) await auth.client.auth.signOut({scope: 'local'}); }
      finally { auth.clearSession(); redirect(); }
    };
    // Identity changes in another tab require a reload. Never keep the first
    // user's in-memory GPS/history state visible under a different account.
    auth.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { auth.clearSession(); redirect(); }
      else if (session?.user?.id && session.user.id !== user.id) location.reload();
    });
    const load = src => new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = src;
      script.onload = resolve; script.onerror = reject; document.body.append(script);
    });
    // Size the map only after the application is visible.
    document.documentElement.classList.remove('auth-pending'); status.hidden = true;
    for (const script of ['./leaflet.js', './app.js', './nautical.js', './route.js', './history.js']) await load(script);
    if (window.paratyMap) window.paratyMap.invalidateSize();
  } catch {
    status.hidden = false; status.textContent = 'Não foi possível abrir o sistema. Recarregue a página.';
  }
})();
