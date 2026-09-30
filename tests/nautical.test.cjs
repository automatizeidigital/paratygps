const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const manifest = JSON.parse(fs.readFileSync('charts/1633/manifest.json'));
const tick = () => new Promise(resolve => setImmediate(resolve));
async function scenario({failAt = -1, existing = new Map()} = {}) {
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, {value: '', textContent: '', disabled: true, hidden: true}); return elements.get(id); };
  let online = true, requestCount = 0, extent = true;
  const layers = new Set(), events = {}, stores = new Map([['paratygps-charts-' + manifest.version, existing]]);
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {match: async key => store.get(key), put: async (key, value) => {store.set(key, value);}};
    },
    async delete(name) {return stores.delete(name);}
  };
  const map = {
    createPane() {}, getPane: () => ({style: {}}), on() {},
    getBounds: () => ({intersects: () => extent, pad() {return this;}}),
    fitBounds() {extent = true;}
  };
  const window = {paratyMap: map, caches, isSecureContext: true, addEventListener(name, callback) {events[name] = callback;}};
  const response = {ok: true, headers: new Map([['content-type', 'image/webp']]), clone() {return this;}, blob: async () => ({})};
  const context = {window, document: {getElementById: get, baseURI: 'https://example.test/sub/'}, navigator: {get onLine() {return online;}, serviceWorker: {ready: Promise.resolve()}}, caches, URL,
    localStorage: {getItem: () => null, setItem() {}}, createImageBitmap: async () => ({close() {}}),
    fetch: async url => {
      if (url.endsWith('manifest.json')) return {ok: true, json: async () => manifest};
      if (!online || ++requestCount === failAt) throw new Error('network');
      return response;
    },
    L: {latLngBounds: value => value, imageOverlay(url, bounds) {
      const handlers = {};
      const layer = {on(name, callback) {handlers[name] = callback; return this;}, addTo() {layers.add(layer); queueMicrotask(() => handlers.load()); return this;}, remove() {layers.delete(layer);}};
      return layer;
    }}
  };
  vm.runInNewContext(fs.readFileSync('nautical.js', 'utf8'), context);
  await tick(); await tick();
  return {get, layers, stores, window, events, caches, offline() {online = false; events.offline();}, outside() {extent = false;}, requestCount: () => requestCount};
}
(async () => {
  let app = await scenario();
  assert.equal(app.get('chartLayer').value, '163302');
  assert.equal(app.layers.size, 9);
  app.get('chartLayer').value = '163301'; app.get('chartLayer').onchange(); await tick();
  assert.equal(app.layers.size, 20);
  assert.match(app.get('chartInfo').textContent, /16\/04\/2026/);
  app.get('chartLayer').value = 'online'; app.get('chartLayer').onchange();
  assert.equal(app.layers.size, 0);
  app = await scenario({failAt: 3});
  await app.get('chartSave').onclick();
  assert.match(app.get('chartState').textContent, /Download incompleto/);
  assert.equal(app.stores.get('paratygps-charts-' + manifest.version).size, 2);
  await app.get('chartSave').onclick();
  assert.match(app.get('chartState').textContent, /duas folhas foram salvas/);
  assert.equal(app.stores.get('paratygps-charts-' + manifest.version).size, 29);
  assert.equal(app.requestCount(), 30, 'retry reuses the two previously saved chunks');
  await tick(); app.offline();
  assert.equal(app.get('offlineBanner').hidden, true);
  app.outside(); app.events.offline();
  assert.equal(app.get('offlineBanner').hidden, false);
  const saved = app.stores.get('paratygps-charts-' + manifest.version);
  const reopened = await scenario({existing: saved});
  assert.match(reopened.get('chartState').textContent, /duas folhas estão salvas/);
  await reopened.get('chartRemove').onclick();
  assert.equal(reopened.stores.size, 0);
  const listeners = {}, deleted = [];
  vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), {
    self: {addEventListener(name, callback) {listeners[name] = callback;}, clients: {claim: async () => {}}},
    caches: {keys: async () => ['paratygps-shell-v5', 'paratygps-shell-v7', 'paratygps-charts-test', 'other-app'], delete: async name => deleted.push(name)}
  });
  let work; listeners.activate({waitUntil(promise) {work = promise;}}); await work;
  assert.deepEqual(deleted, ['paratygps-shell-v5']);
  console.log('PASS: sheet switching, partial download, retry, cache detection, coverage, removal and service-worker cache preservation');
})().catch(error => {console.error(error); process.exitCode = 1;});
