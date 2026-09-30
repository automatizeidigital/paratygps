(() => {
  'use strict';
  const map = window.paratyMap;
  if (!map) return;
  const $ = id => document.getElementById(id), wrap = document.querySelector('.mapwrap');
  const toggle = $('fullscreenBtn'), tools = document.querySelector('.fullscreen-tools');
  const placeholder = document.createComment('map-position');
  wrap.before(placeholder);
  let expanded = false, historyAdded = false, scrollPosition = 0;
  const dialog = $('pointNameDialog'), input = $('pointNameInput');
  window.paratyAskPointName = (defaultName, title = 'Salvar ponto') => {
    $('pointDialogTitle').textContent = title;
    if (dialog.open) return Promise.resolve(null);
    return new Promise(resolve => {
      let result = null;
      const finish = () => { dialog.removeEventListener('close', finish); resolve(result); };
      dialog.addEventListener('close', finish);
      $('pointNameForm').onsubmit = event => { event.preventDefault(); result = input.value; dialog.close(); };
      $('pointCancel').onclick = () => dialog.close();
      input.value = defaultName;
      dialog.showModal(); input.focus(); input.select();
    });
  };
  const syncTools = () => {
    $('fullscreenGps').textContent = $('gpsLabel').textContent;
    $('fullscreenTrack').textContent = $('trackBtn').textContent;
  };
  const resize = () => requestAnimationFrame(() => map.invalidateSize({pan:false}));
  const render = () => {
    document.body.classList.toggle('map-expanded', expanded);
    wrap.classList.toggle('map-fullscreen-active', expanded);
    toggle.textContent = expanded ? 'Voltar aos ajustes' : 'Tela cheia';
    toggle.setAttribute('aria-expanded', String(expanded));
    tools.hidden = !expanded;
    syncTools(); resize();
  };
  const open = () => {
    if (expanded) return;
    scrollPosition = window.scrollY;
    expanded = true;
    // Use a full viewport inside the app, including Android WebViews and PWAs.
    // Reuse the map node outside the panel/grid so its height is unrestricted.
    document.body.append(wrap);
    render();
    try { history.pushState({...history.state,paratyMapFullscreen:true}, '', location.href); historyAdded = true; } catch {}
    toggle.focus({preventScroll:true});
  };
  const restore = () => {
    if (!expanded) return;
    expanded = false;
    if (dialog.open) dialog.close();
    placeholder.after(wrap);
    render();
    window.scrollTo(0,scrollPosition);
    $('openMapBtn').focus({preventScroll:true});
  };
  const close = () => {
    restore();
    if (historyAdded) { historyAdded = false; history.back(); }
  };
  toggle.onclick = () => expanded ? close() : open();
  $('openMapBtn').onclick = open;
  $('fullscreenMark').onclick = () => $('markBtn').click();
  $('fullscreenTrack').onclick = () => { $('trackBtn').click(); syncTools(); };
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && expanded && !dialog.open) close(); });
  window.addEventListener('popstate', () => { if (expanded) { historyAdded = false; restore(); } });
  window.addEventListener('resize', resize);
  window.addEventListener('paraty-position', syncTools);
  const observer = new MutationObserver(syncTools);
  observer.observe($('gpsLabel'), {childList:true,subtree:true,characterData:true});
  observer.observe($('trackBtn'), {childList:true,subtree:true,characterData:true});
})();
