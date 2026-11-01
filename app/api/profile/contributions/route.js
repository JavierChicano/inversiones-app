import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { CurrencyExchangeRepository } from '@/lib/repository/currencyExchange.repository';
import { findAllUserTransactions } from '@/lib/repository/transaction.repository';
import { getCurrentEurUsdRate } from '@/lib/services/currencyExchange.service';
import { jsonError } from '@/lib/api/http';
import { buildContributionSeries, flowsFromExchanges, flowsFromTransactions } from '@/lib/utils/contributions';

/**
 * GET /api/profile/contributions
 * Disciplina de aportación: serie mensual de aportaciones netas en EUR y métricas asociadas.
 * Usa los cambios de divisa; si el usuario no registra ninguno, aproxima con compras menos ventas.
 */
export async function GET(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const exchanges = await CurrencyExchangeRepository.getByUserId(auth.userId);

    let source = 'exchanges';
    let flows = flowsFromExchanges(exchanges);

    if (flows.length === 0) {
      const [eurUsdRate, transactions] = await Promise.all([
        getCurrentEurUsdRate(),
        findAllUserTransactions(auth.userId),
      ]);

      source = 'transactions';
      flows = flowsFromTransactions(transactions, eurUsdRate);
    }

    const { months, metrics } = buildContributionSeries(flows);

    return NextResponse.json({ source, months, metrics });
  } catch (error) {
    console.error('Error en GET /api/profile/contributions:', error);
    return jsonError('Error al calcular la disciplina de aportación', 500);
  }
}
