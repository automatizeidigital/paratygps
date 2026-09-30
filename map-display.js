(() => {
  'use strict';
  const map = window.paratyMap;
  if (!map) return;
  const $ = id => document.getElementById(id), wrap = document.querySelector('.mapwrap');
  const toggle = $('fullscreenBtn'), tools = document.querySelector('.fullscreen-tools');
  let expanded = false, fallbackHistory = false;
  const dialog = $('pointNameDialog'), input = $('pointNameInput');
  window.paratyAskPointName = defaultName => {
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
  const setExpanded = value => {
    expanded = value;
    document.body.classList.toggle('map-expanded', value);
    toggle.textContent = value ? '↙ Voltar aos ajustes' : '⛶ Tela cheia';
    toggle.setAttribute('aria-expanded', String(value));
    tools.hidden = !value;
    syncTools(); resize();
    if (!value) $('openMapBtn').focus({preventScroll:true});
  };
  const open = async () => {
    if (expanded) return;
    setExpanded(true);
    try {
      if (!wrap.requestFullscreen) throw new Error('Fullscreen unavailable');
      await wrap.requestFullscreen();
    } catch {
      // Fixed viewport works in iOS Safari and installed PWAs too.
      if (!expanded) return;
      history.pushState({paratyMapFullscreen:true}, '', location.href);
      fallbackHistory = true;
    }
    resize();
  };
  const close = async () => {
    if (document.fullscreenElement === wrap) {
      try { await document.exitFullscreen(); } catch { setExpanded(false); }
    } else {
      setExpanded(false);
      if (fallbackHistory) { fallbackHistory = false; history.back(); }
    }
  };
  toggle.onclick = () => expanded ? close() : open();
  $('openMapBtn').onclick = open;
  $('fullscreenMark').onclick = () => $('markBtn').click();
  $('fullscreenTrack').onclick = () => { $('trackBtn').click(); syncTools(); };
  document.addEventListener('fullscreenchange', () => { setExpanded(document.fullscreenElement === wrap); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && expanded && !dialog.open) close(); });
  window.addEventListener('popstate', () => { if (fallbackHistory) { fallbackHistory = false; setExpanded(false); } });
  window.addEventListener('resize', resize);
  window.addEventListener('paraty-position', syncTools);
  // GPS labels may change after a fix or permission error.
  const observer = new MutationObserver(syncTools);
  observer.observe($('gpsLabel'), {childList:true,subtree:true,characterData:true});
  observer.observe($('trackBtn'), {childList:true,subtree:true,characterData:true});
})();
