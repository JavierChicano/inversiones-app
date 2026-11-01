/**
 * Comprueba que el build reducido de ECharts (lib/charts/echarts.js) registra todo lo que
 * usan los gráficos de la app. ECharts avisa por consola ("is used but not imported") cuando
 * una opción necesita un componente no registrado; renderizamos en modo SSR (SVG) cada tipo
 * de opción que usan los componentes y fallamos si aparece ese aviso.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as echarts from '@/lib/charts/echarts';
import { SVGRenderer } from 'echarts/renderers';

// En Node no hay canvas: para renderizar usamos SVG en modo SSR (solo en el test)
echarts.use([SVGRenderer]);

const warnings = [];
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => warnings.push(args.join(' '));
  console.warn = (...args) => warnings.push(args.join(' '));
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

function render(option) {
  warnings.length = 0;
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 600, height: 400 });
  chart.setOption(option);
  const svg = chart.renderToSVGString();
  chart.dispose();
  const missing = warnings.filter((w) => /used but not imported|not registered|is not exist/i.test(w));
  return { svg, missing };
}

describe('registro de ECharts', () => {
  test('exporta init y graphic como el paquete completo', () => {
    expect(typeof echarts.init).toBe('function');
    expect(typeof echarts.graphic.LinearGradient).toBe('function');
  });

  test('ProgressionChart: líneas con área degradada, markPoint, leyenda y tooltip de eje', () => {
    const { svg, missing } = render({
      tooltip: { trigger: 'axis' },
      legend: { data: ['Valor Total', 'Invertido'] },
      grid: { containLabel: true },
      xAxis: { type: 'category', data: ['a', 'b', 'c'] },
      yAxis: { type: 'value', scale: true },
      series: [
        {
          name: 'Valor Total',
          type: 'line',
          smooth: true,
          data: [1, 2, 3],
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }]) },
          markPoint: { symbol: 'pin', data: [{ coord: [1, 2], value: '▲AAPL' }] },
        },
        { name: 'Invertido', type: 'line', data: [1, 1, 1], lineStyle: { type: 'dashed' } },
      ],
    });
    expect(missing).toEqual([]);
    expect(svg).toContain('<svg');
  });

  test('RealizedGainsChart: línea + barras', () => {
    const { missing } = render({
      tooltip: { trigger: 'axis' },
      legend: { data: ['Acumulada', 'Periodo'] },
      grid: {},
      xAxis: { type: 'category', data: ['a', 'b'] },
      yAxis: { type: 'value' },
      series: [
        { name: 'Acumulada', type: 'line', data: [1, 2], symbol: 'circle' },
        { name: 'Periodo', type: 'bar', data: [{ value: 1, itemStyle: { color: '#0f0' } }, { value: -1 }] },
      ],
    });
    expect(missing).toEqual([]);
  });

  test('StockDistributionChart / WinRateChart: tarta con texto gráfico y leyenda', () => {
    const { missing } = render({
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical' },
      graphic: [{ type: 'text', left: 'center', top: 'center', style: { text: '$1.000' } }],
      series: [
        {
          type: 'pie',
          radius: ['50%', '75%'],
          label: { show: true, formatter: '{b}', rich: { name: { fontSize: 14 } } },
          labelLine: { show: true },
          data: [{ value: 60, name: 'AAPL' }, { value: 40, name: 'BTC' }],
        },
      ],
    });
    expect(missing).toEqual([]);
  });

  test('ContributionDisciplineChart: barras con dataZoom, markLine y axisPointer', () => {
    const { missing } = render({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: {},
      xAxis: { type: 'category', data: Array.from({ length: 30 }, (_, i) => `m${i}`) },
      yAxis: { type: 'value' },
      dataZoom: [{ type: 'slider', start: 50, end: 100 }],
      series: [
        {
          type: 'bar',
          showBackground: true,
          data: Array.from({ length: 30 }, (_, i) => i - 10),
          markLine: { silent: true, symbol: 'none', data: [{ yAxis: 5 }] },
        },
      ],
    });
    expect(missing).toEqual([]);
  });

  test('un componente no registrado sí se detecta (control del propio test)', () => {
    const { missing } = render({
      xAxis: { type: 'category', data: ['a'] },
      yAxis: { type: 'value' },
      series: [{ type: 'scatter', data: [[0, 1]] }],
    });
    expect(missing.length).toBeGreaterThan(0);
  });
});
