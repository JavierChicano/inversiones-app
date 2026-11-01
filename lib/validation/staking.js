import { fail, normalizeTicker, ok, toFiniteNumber, toValidDate } from './common.js';

/**
 * Valida el alta (o aporte adicional) de una posición de staking.
 */
export function validateNewStakingPosition(body = {}) {
  const assetTicker = normalizeTicker(body.assetTicker);
  const amountStaked = toFiniteNumber(body.amountStaked);
  const manualApy = toFiniteNumber(body.manualApy);
  const lockPeriodDays =
    body.lockPeriodDays === undefined || body.lockPeriodDays === null || body.lockPeriodDays === ''
      ? 0
      : toFiniteNumber(body.lockPeriodDays);
  const startDate = toValidDate(body.startDate);

  if (!assetTicker || amountStaked === null || manualApy === null || !body.startDate) {
    return fail('Faltan campos requeridos');
  }

  if (amountStaked <= 0 || manualApy < 0) {
    return fail('Cantidad y APY deben ser valores válidos');
  }

  if (lockPeriodDays === null || lockPeriodDays < 0 || !Number.isInteger(lockPeriodDays)) {
    return fail('El período de bloqueo no puede ser negativo');
  }

  if (!startDate) {
    return fail('Fecha de inicio inválida');
  }

  return ok({ assetTicker, amountStaked, manualApy, lockPeriodDays, startDate });
}

/**
 * Valida una retirada (parcial o total) de staking.
 */
export function validateUnstake(body = {}) {
  const amountToUnstake = toFiniteNumber(body.amountToUnstake);

  if (amountToUnstake === null || amountToUnstake <= 0) {
    return fail('La cantidad a retirar debe ser mayor que 0');
  }

  return ok({ amountToUnstake });
}
