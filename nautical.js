/* Separate sheets preserve their different correction dates. */
(() => {
  'use strict';
  const map = window.paratyMap;
  if (!map) return;
  const $ = id => document.getElementById(id);
  const select = $('chartLayer'), info = $('chartInfo'), state = $('chartState');
  const save = $('chartSave'), remove = $('chartRemove'), view = $('chartView'), banner = $('offlineBanner');
  let manifest, sheet, busy = false, overlays = new Map(), generation = 0;
  const cacheName = () => 'paratygps-charts-' + manifest.version;
  const message = value => { state.textContent = value; };
  const absolute = path => new URL(path, document.baseURI).href;
  map.createPane('nautical');
  map.getPane('nautical').style.zIndex = 250;
  map.getPane('nautical').style.pointerEvents = 'none';
  async function isSaved() {
    if (!window.caches || !manifest) return false;
    const cache = await caches.open(cacheName());
    for (const s of manifest.sheets) for (const c of s.chunks) {
      if (!(await cache.match(absolute(c.url)))) return false;
    }
    return true;
  }
  function updateCoverage() {
    window.paratyChartVisible = Boolean(sheet && [...overlays.values()].some(o => o.loaded && map.getBounds().intersects(o.bounds)));
    if (window.paratyChartVisible) banner.hidden = true;
    else if (!navigator.onLine) {
      banner.innerHTML = '<strong>Sem mapa nesta área</strong><br>Selecione uma carta salva e use “Ver carta”. O mapa colaborativo precisa de internet.';
      banner.hidden = false;
    }
  }
  function render() {
    const currentGeneration = generation, wanted = new Set();
    if (sheet) for (const chunk of sheet.chunks) {
      const bounds = L.latLngBounds(chunk.bounds);
      if (!map.getBounds().pad(0.15).intersects(bounds)) continue;
      wanted.add(chunk.url);
      if (overlays.has(chunk.url)) continue;
      const item = {bounds, loaded: false};
      const layer = L.imageOverlay(chunk.url, bounds, {pane: 'nautical', interactive: false, attribution: 'Carta 1633 · Marinha do Brasil / DHN · arquivo fornecido'});
      item.layer = layer; overlays.set(chunk.url, item);
      layer.on('load', () => { item.loaded = true; updateCoverage(); });
      layer.on('error', () => {
        if (generation === currentGeneration) message('Parte da carta não carregou. Conecte-se e salve as duas folhas para usar offline.');
        updateCoverage();
      });
      layer.addTo(map);
    }
    for (const [url, item] of overlays) if (!wanted.has(url)) {
      item.layer.remove(); overlays.delete(url);
    }
    updateCoverage();
  }
  function changeSheet() {
    generation++;
    for (const item of overlays.values()) item.layer.remove();
    overlays.clear(); sheet = manifest.sheets.find(s => s.id === select.value);
    view.disabled = !sheet;
    if (sheet) {
      const date = sheet.correctionDate.split('/');
      info.textContent = `Folha ${sheet.id} · escala 1:${sheet.scale.toLocaleString('pt-BR')} · correção informada: ${date[1]}/${date[0]}/${date[2]} (${sheet.correction}). Confira atualizações e avisos antes de navegar.`;
    } else info.textContent = 'Mapa colaborativo online. As cartas salvas podem ser selecionadas acima.';
    try { localStorage.setItem('paratygps-chart', select.value); } catch {}
    render();
  }
  view.onclick = () => { if (sheet) map.fitBounds(sheet.bounds); };
  select.onchange = changeSheet;
  map.on('moveend zoomend', render);
  window.addEventListener('offline', updateCoverage);
  window.addEventListener('online', () => {
    for (const [url, item] of overlays) if (!item.loaded) { item.layer.remove(); overlays.delete(url); }
    render();
  });
  save.onclick = async () => {
    if (busy || !manifest) return;
    if (!window.caches || !window.isSecureContext || !('serviceWorker' in navigator)) {
      message('O salvamento offline requer HTTPS e um navegador com suporte a armazenamento local.'); return;
    }
    busy = true; save.disabled = remove.disabled = true;
    try {
      await navigator.serviceWorker.ready;
      const cache = await caches.open(cacheName()), chunks = manifest.sheets.flatMap(s => s.chunks);
      let done = 0;
      for (const chunk of chunks) {
        const url = absolute(chunk.url);
        if (!(await cache.match(url))) {
          const response = await fetch(url, {cache: 'reload'});
          if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('download');
          const bitmap = await createImageBitmap(await response.clone().blob()); bitmap.close();
          await cache.put(url, response);
        }
        message(`Salvando cartas: ${++done}/${chunks.length} partes…`);
      }
      if (!(await isSaved())) throw new Error('incomplete');
      message('As duas folhas foram salvas neste aparelho. Disponíveis offline nesta área; o navegador pode remover os dados se faltar espaço.');
      changeSheet();
    } catch {
      message('Download incompleto. Confira a conexão e o espaço disponível e tente novamente. As partes já salvas serão reaproveitadas.');
    } finally { busy = false; save.disabled = remove.disabled = false; }
  };
  remove.onclick = async () => {
    if (busy || !window.caches || !manifest) return;
    await caches.delete(cacheName());
    message('Cópia offline das cartas removida. Seus pontos e percursos foram mantidos.');
  };
  async function start() {
    try {
      const response = await fetch('./charts/1633/manifest.json');
      if (!response.ok) throw new Error('manifest');
      manifest = await response.json();
      const total = manifest.sheets.flatMap(s => s.chunks).reduce((n, c) => n + c.bytes, 0);
      save.textContent = `↓ Salvar cartas offline (${(total / 1048576).toFixed(1).replace('.', ',')} MB)`;
      let preference = '163302';
      try { preference = localStorage.getItem('paratygps-chart') || preference; } catch {}
      select.value = ['online', ...manifest.sheets.map(s => s.id)].includes(preference) ? preference : '163302';
      select.disabled = save.disabled = remove.disabled = false;
      changeSheet();
      message(await isSaved() ? 'As duas folhas estão salvas para uso offline neste aparelho.' : 'Para usar sem internet, salve as duas folhas neste aparelho.');
    } catch { message('Não foi possível carregar as cartas. Confira a conexão e recarregue.'); }
  }
  start();
})();
