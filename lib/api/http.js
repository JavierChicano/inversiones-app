import { NextResponse } from 'next/server';

/**
 * Lee el cuerpo JSON de una petición. Devuelve `null` si no es JSON válido o está vacío.
 * @param {Request} request
 * @returns {Promise<object|null>}
 */
export async function readJsonBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

/** Respuesta JSON de error con el status indicado */
export function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Convierte el resultado de un validador ({ok:false,error,status}) en respuesta JSON */
export function validationError(result) {
  return jsonError(result.error, result.status || 400);
}

/** Parsea un id numérico positivo de la URL; devuelve null si no es válido */
export function parsePositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
