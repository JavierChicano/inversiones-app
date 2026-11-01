/**
 * Helpers para invocar handlers de rutas de Next.js directamente, sin servidor HTTP.
 */

const BASE_URL = 'http://localhost:3000';

/**
 * Construye una Request para un handler de ruta.
 * @param {string} path - p. ej. '/api/transactions?limit=5'
 * @param {{ method?: string, headers?: object, body?: any, cookie?: string }} [options]
 */
export function makeRequest(path, { method = 'GET', headers = {}, body, cookie } = {}) {
  const init = { method, headers: { ...headers } };

  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  if (cookie) {
    init.headers.Cookie = cookie;
  }

  return new Request(`${BASE_URL}${path}`, init);
}

/** Simula el segundo argumento `{ params }` de los handlers dinámicos (es una Promise en Next 15+). */
export function routeParams(params) {
  return { params: Promise.resolve(params) };
}

/** Lee la respuesta como JSON junto con su status. */
export async function readJson(response) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

/** Atajo: ejecuta un handler y devuelve { status, json }. */
export async function call(handler, path, options, params) {
  const request = makeRequest(path, options);
  const response = params ? await handler(request, routeParams(params)) : await handler(request);
  return readJson(response);
}
