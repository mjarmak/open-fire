// This module is imported only by the dedicated demo entry point.
export function installDemoIsolation(app: string): void {
  // Demo caches must never read or overwrite a signed-in user's storage.
  for (const name of ['localStorage', 'sessionStorage']) {
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() { return values.size; },
      key: (index) => Array.from(values.keys())[index] ?? null,
      getItem: (key) => values.get(String(key)) ?? null,
      setItem: (key, value) => { values.set(String(key), String(value)); },
      removeItem: (key) => { values.delete(String(key)); },
      clear: () => values.clear()
    };
    Object.defineProperty(window, name, { configurable: true, value: storage });
  }
  const openDatabase = indexedDB.open.bind(indexedDB);
  indexedDB.open = (name, version) => openDatabase(`jenius-demo:${app}:${name}`, version);
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, options) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const method = (options?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.protocol === 'blob:' && method === 'GET') return nativeFetch(input, options);
    const staticAsset = url.origin === location.origin
      && /^\/(demo\/)?(assets|brand|media|sound-packs)\//.test(url.pathname)
      && !url.pathname.includes('..');
    if (!staticAsset || method !== 'GET') {
      return Promise.reject(new Error('This action is available in the full app.'));
    }
    if (!url.pathname.startsWith('/demo/')) url.pathname = '/demo' + url.pathname;
    const headers = new Headers(options?.headers);
    headers.delete('Authorization');
    return nativeFetch(url, { ...options, method: 'GET', headers, credentials: 'omit' });
  };
  document.documentElement.dataset['userId'] = 'jenius-demo';
  document.querySelector<HTMLButtonElement>('#reset-demo')?.addEventListener('click', () => location.reload());
}
