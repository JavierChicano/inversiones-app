/**
 * Build reducido de ECharts: solo se registran los gráficos y componentes que usa la app.
 * Importar desde aquí (`import * as echarts from '@/lib/charts/echarts'`) en lugar de 'echarts'
 * reduce el bundle de cliente a una fracción del paquete completo.
 *
 * Si un gráfico nuevo necesita otro tipo de serie o componente, añádelo a la lista de `use()`.
 */
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  AxisPointerComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  AxisPointerComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export const { init, use, graphic, getInstanceByDom, dispose } = echarts;
export default echarts;
