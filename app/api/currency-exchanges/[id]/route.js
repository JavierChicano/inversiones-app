import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { CurrencyExchangeRepository } from "@/lib/repository/currencyExchange.repository";

/**
 * GET /api/currency-exchanges/[id]
 * Obtener un cambio de divisa específico
 */
export async function GET(request, { params }) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const { id } = await params;
    const exchange = await CurrencyExchangeRepository.getById(parseInt(id), decoded.userId);

    if (!exchange) {
      return NextResponse.json(
        { error: "Cambio de divisa no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(exchange);
  } catch (error) {
    console.error("Error en GET /api/currency-exchanges/[id]:", error);
    return NextResponse.json(
      { error: "Error al obtener cambio de divisa" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/currency-exchanges/[id]
 * Actualizar un cambio de divisa
 */
export async function PUT(request, { params }) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { fromCurrency, toCurrency, amount, exchangeRate, date } = body;

    // Validar que el cambio existe y pertenece al usuario
    const existing = await CurrencyExchangeRepository.getById(parseInt(id), decoded.userId);
    if (!existing) {
      return NextResponse.json(
        { error: "Cambio de divisa no encontrado" },
        { status: 404 }
      );
    }

    // Preparar datos de actualización
    const updateData = {};
    if (fromCurrency) updateData.fromCurrency = fromCurrency;
    if (toCurrency) updateData.toCurrency = toCurrency;
    if (amount) updateData.amount = parseFloat(amount);
    if (exchangeRate) updateData.exchangeRate = parseFloat(exchangeRate);
    if (date) updateData.date = new Date(date);

    const updated = await CurrencyExchangeRepository.update(
      parseInt(id),
      decoded.userId,
      updateData
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error en PUT /api/currency-exchanges/[id]:", error);
    return NextResponse.json(
      { error: "Error al actualizar cambio de divisa" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/currency-exchanges/[id]
 * Eliminar un cambio de divisa
 */
export async function DELETE(request, { params }) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const { id } = await params;

    // Validar que el cambio existe y pertenece al usuario
    const existing = await CurrencyExchangeRepository.getById(parseInt(id), decoded.userId);
    if (!existing) {
      return NextResponse.json(
        { error: "Cambio de divisa no encontrado" },
        { status: 404 }
      );
    }

    await CurrencyExchangeRepository.delete(parseInt(id), decoded.userId);

    return NextResponse.json({ message: "Cambio de divisa eliminado" });
  } catch (error) {
    console.error("Error en DELETE /api/currency-exchanges/[id]:", error);
    return NextResponse.json(
      { error: "Error al eliminar cambio de divisa" },
      { status: 500 }
    );
  }
}
