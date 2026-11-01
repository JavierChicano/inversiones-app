import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { CurrencyExchangeRepository } from '@/lib/repository/currencyExchange.repository';
import { jsonError, parsePositiveInt, readJsonBody, validationError } from '@/lib/api/http';
import { validateCurrencyExchangeUpdate } from '@/lib/validation/currencyExchange';

async function loadOwnedExchange(request, params) {
  const auth = requireUser(request);
  if (auth.error) return { error: auth.error };

  const { id } = await params;
  const exchangeId = parsePositiveInt(id);
  if (!exchangeId) {
    return { error: jsonError('ID inválido', 400) };
  }

  const exchange = await CurrencyExchangeRepository.getById(exchangeId, auth.userId);
  if (!exchange) {
    return { error: jsonError('Cambio de divisa no encontrado', 404) };
  }

  return { userId: auth.userId, exchange };
}

/** GET /api/currency-exchanges/[id] */
export async function GET(request, { params }) {
  try {
    const result = await loadOwnedExchange(request, params);
    if (result.error) return result.error;

    return NextResponse.json(result.exchange);
  } catch (error) {
    console.error('Error en GET /api/currency-exchanges/[id]:', error);
    return jsonError('Error al obtener cambio de divisa', 500);
  }
}

/** PUT /api/currency-exchanges/[id] */
export async function PUT(request, { params }) {
  try {
    const result = await loadOwnedExchange(request, params);
    if (result.error) return result.error;

    const validation = validateCurrencyExchangeUpdate((await readJsonBody(request)) || {}, result.exchange);
    if (!validation.ok) return validationError(validation);

    const updated = await CurrencyExchangeRepository.update(result.exchange.id, result.userId, validation.data);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error en PUT /api/currency-exchanges/[id]:', error);
    return jsonError('Error al actualizar cambio de divisa', 500);
  }
}

/** DELETE /api/currency-exchanges/[id] */
export async function DELETE(request, { params }) {
  try {
    const result = await loadOwnedExchange(request, params);
    if (result.error) return result.error;

    await CurrencyExchangeRepository.delete(result.exchange.id, result.userId);

    return NextResponse.json({ message: 'Cambio de divisa eliminado' });
  } catch (error) {
    console.error('Error en DELETE /api/currency-exchanges/[id]:', error);
    return jsonError('Error al eliminar cambio de divisa', 500);
  }
}
