/**
 * Sustituye globalThis.fetch por un stub basado en rutas durante un test.
 *
 *   const fetchMock = installFetchMock([
 *     { match: /api.twelvedata.com\/price/, response: { AAPL: { price: '150' } } },
 *     { match: (url) => url.includes('coingecko'), status: 429, response: { error: 'rate limit' } },
 *   ]);
 *   ... fetchMock.calls → urls llamadas; fetchMock.restore()
 */
export function installFetchMock(routes = []) {
  const original = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, init });

    for (const route of routes) {
      const matches = typeof route.match === 'function' ? route.match(url) : route.match.test(url);
      if (!matches) continue;

      if (route.error) {
        throw route.error instanceof Error ? route.error : new Error(String(route.error));
      }

      const body = typeof route.response === 'function' ? route.response(url) : route.response;
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status: route.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`fetch no mockeado para ${url}`);
  };

  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}
