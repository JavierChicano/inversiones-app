import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { CurrencyExchangeRepository } from '@/lib/repository/currencyExchange.repository';
import { getCurrentEurUsdRate } from '@/lib/services/currencyExchange.service';
import { enrichExchange, summarizeExchanges } from '@/lib/utils/currencyExchangeMetrics';
import { jsonError, readJsonBody, validationError } from '@/lib/api/http';
import { validateNewCurrencyExchange } from '@/lib/validation/currencyExchange';

/**
 * GET /api/currency-exchanges — cambios del usuario enriquecidos con el tipo actual, resumen y tipos vigentes
 */
export async function GET(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const [exchanges, currentRateEurUsd] = await Promise.all([
      CurrencyExchangeRepository.getByUserId(auth.userId),
      getCurrentEurUsdRate(),
    ]);

    return NextResponse.json({
      exchanges: exchanges.map((exchange) => enrichExchange(exchange, currentRateEurUsd)),
      summary: summarizeExchanges(exchanges),
      currentRate: {
        eurToUsd: currentRateEurUsd,
        usdToEur: 1 / currentRateEurUsd,
      },
    });
  } catch (error) {
    console.error('Error en GET /api/currency-exchanges:', error);
    return jsonError('Error al obtener cambios de divisa', 500);
  }
}

/**
 * POST /api/currency-exchanges — crear un cambio de divisa
 */
export async function POST(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const validation = validateNewCurrencyExchange((await readJsonBody(request)) || {});
    if (!validation.ok) return validationError(validation);

    const newExchange = await CurrencyExchangeRepository.create({
      userId: auth.userId,
      ...validation.data,
    });

    return NextResponse.json(newExchange, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/currency-exchanges:', error);
    return jsonError('Error al crear cambio de divisa', 500);
  }
}
