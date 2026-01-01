import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { CurrencyExchangeRepository } from "@/lib/repository/currencyExchange.repository";
import { CurrencyExchangeService } from "@/lib/services/currencyExchange.service";

/**
 * GET /api/currency-exchanges
 * Obtener todos los cambios de divisa del usuario
 */
export async function GET(request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // Obtener cambios de divisa
    const exchanges = await CurrencyExchangeRepository.getByUserId(decoded.userId);

    // Enriquecer con datos actuales
    const currentRate = await CurrencyExchangeService.getCurrentExchangeRate('EUR', 'USD');
    const enrichedExchanges = exchanges.map(exchange => {
      const profitLoss = CurrencyExchangeService.calculateProfitLoss(
        exchange.amount,
        exchange.exchangeRate,
        exchange.fromCurrency === 'EUR' ? currentRate : 1/currentRate,
        exchange.fromCurrency
      );

      const breakEvenRate = exchange.exchangeRate;
      const goodTargetRate = CurrencyExchangeService.calculateTargetRate(
        exchange.exchangeRate, 
        5, 
        exchange.fromCurrency
      );
      const excellentTargetRate = CurrencyExchangeService.calculateTargetRate(
        exchange.exchangeRate, 
        10, 
        exchange.fromCurrency
      );

      return {
        ...exchange,
        currentRate: exchange.fromCurrency === 'EUR' ? currentRate : 1/currentRate,
        ...profitLoss,
        breakEvenRate,
        goodTargetRate,
        excellentTargetRate,
      };
    });

    // Obtener resumen
    const summary = await CurrencyExchangeRepository.getSummary(decoded.userId);

    return NextResponse.json({
      exchanges: enrichedExchanges,
      summary,
      currentRate: {
        eurToUsd: currentRate,
        usdToEur: 1/currentRate,
      },
    });
  } catch (error) {
    console.error("Error en GET /api/currency-exchanges:", error);
    return NextResponse.json(
      { error: "Error al obtener cambios de divisa" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/currency-exchanges
 * Crear un nuevo cambio de divisa
 */
export async function POST(request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const body = await request.json();
    const { fromCurrency, toCurrency, amount, exchangeRate, date } = body;

    // Validaciones
    if (!fromCurrency || !toCurrency || !amount || !exchangeRate || !date) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    if (!['EUR', 'USD'].includes(fromCurrency) || !['EUR', 'USD'].includes(toCurrency)) {
      return NextResponse.json(
        { error: "Divisas no soportadas" },
        { status: 400 }
      );
    }

    if (fromCurrency === toCurrency) {
      return NextResponse.json(
        { error: "Las divisas deben ser diferentes" },
        { status: 400 }
      );
    }

    // Crear el cambio
    const newExchange = await CurrencyExchangeRepository.create({
      userId: decoded.userId,
      fromCurrency,
      toCurrency,
      amount: parseFloat(amount),
      exchangeRate: parseFloat(exchangeRate),
      date: new Date(date),
    });

    return NextResponse.json(newExchange, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/currency-exchanges:", error);
    return NextResponse.json(
      { error: "Error al crear cambio de divisa" },
      { status: 500 }
    );
  }
}
