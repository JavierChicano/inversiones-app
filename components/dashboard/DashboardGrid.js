"use client";

import StatsCard from "./StatsCard";
import StockDistributionChart from "./StockDistributionChart";
import WinRateChart from "./WinRateChart";
import ProgressionChart from "./ProgressionChart";
import PositionsTable from "./PositionsTable";
import {
  TrendingUpIcon,
  CashIcon,
  PercentIcon,
  BarChartIcon,
  CreditCardIcon,
  DollarIcon,
} from "../icons";

export default function DashboardGrid({ data }) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Cargando dashboard...</div>
      </div>
    );
  }

  const formatCurrency = (value, currency = "EUR") => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  // Calcular la ganancia/pérdida absoluta basada en el ROI
  const roiAmount = (data.stats.portfolioTotal.eur - data.stats.invested.eur);
  
  return (
    <div className="space-y-6">
      {/* Grid principal con 6 columnas */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 auto-rows-fr">
        {/* Primera fila: Portfolio (2 cols), Invertido (1 col), Stock Chart (3 cols x 2 rows) */}
        <div className="lg:col-span-2">
          <StatsCard
            title="Portfolio"
            value={formatCurrency(data.stats.portfolioTotal.eur)}
            subValue={formatCurrency(data.stats.portfolioTotal.usd, "USD")}
            color="blue"
            icon={<CreditCardIcon className="w-6 h-6" />}
            large
          />
        </div>

        <StatsCard
          title="Invertido"
          value={formatCurrency(data.stats.invested.eur)}
          subValue={formatCurrency(data.stats.invested.usd, "USD")}
          color="blue"
          icon={<CashIcon className="w-6 h-6" />}
        />

        {/* Stock Distribution Chart - ocupa 3 columnas y 2 filas */}
        <div className="col-span-2 lg:col-span-3 lg:row-span-2">
          <StockDistributionChart 
            data={data.stockDistribution} 
            exchangeRate={data.exchangeRate.eurUsd}
          />
        </div>

        {/* Segunda fila: Neto Total, ROI, Ganancia Media (1 columna cada una) */}
        <StatsCard
          title="Neto Total"
          value={
            <span className={data.stats.netTotal.eur >= 0 ? "text-green-500" : "text-red-500"}>
              {formatCurrency(data.stats.netTotal.eur)}
            </span>
          }
          subValue={`Posiciones cerradas: ${data.stats.closedPositions || 0}`}
          color={data.stats.netTotal.eur >= 0 ? "green" : "red"}
          icon={<TrendingUpIcon className="w-6 h-6" />}
        />

        <StatsCard
          title="ROI"
          value={
            <span className={data.stats.roi >= 0 ? "text-green-500" : "text-red-500"}>
              {formatPercent(data.stats.roi)}
            </span>
          }
          subValue={`${roiAmount >= 0 ? "Ganancia" : "Pérdida"}: ${formatCurrency(Math.abs(roiAmount))}`}
          color={data.stats.roi >= 0 ? "green" : "red"}
          icon={<BarChartIcon className="w-6 h-6" />}
        />

        <StatsCard
          title="Ganancia Media"
          value={
            <span className={data.stats.avgGain >= 0 ? "text-purple-500" : "text-orange-500"}>
              {formatPercent(data.stats.avgGain)}
            </span>
          }
          subValue={`Posiciones ganadoras: ${((data.stats.winRate / 100) * data.stockDistribution.length).toFixed(0)}/${data.stockDistribution.length}`}
          color={data.stats.avgGain >= 0 ? "purple" : "orange"}
          icon={<PercentIcon className="w-6 h-6" />}
        />
      </div>

      {/* Tercera fila tabla de posiciones */}
      <PositionsTable data={data.stockDistribution} />

      {/* Cuarta fila: Gráfico de progresión, Win Rate, Cambio EUR/USD */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
        {/* Progression Chart - 4 columnas (2/3) */}
        <div className="lg:col-span-4 h-full">
          <ProgressionChart data={data.progression} />
        </div>

        <div className="grid lg:col-span-2 gap-4">
          <WinRateChart
            winRate={data.stats.winRate}
            positions={data.stockDistribution}
          />
          <div className="grid gap-4 grid-cols-2">
            <StatsCard
              title="Cambio Eur/Dólar"
              value={data.exchangeRate.eurUsd.toFixed(4)}
              subValue={`1 EUR = ${data.exchangeRate.eurUsd.toFixed(4)} USD`}
              color="indigo"
              icon={<DollarIcon className="w-6 h-6" />}
            />

            <StatsCard
              title="Cambio Dólar/Eur"
              value={(1 / data.exchangeRate.eurUsd).toFixed(4)}
              subValue={`1 USD = ${(1 / data.exchangeRate.eurUsd).toFixed(4)} EUR`}
              color="indigo"
              icon={<DollarIcon className="w-6 h-6" />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
