/**
 * 막대 차트 컴포넌트
 */

'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface BarChartData {
  name: string;
  budget?: number;
  actual?: number;
  previous?: number;
  value?: number;
  rate?: number;
}

interface BarChartProps {
  data: BarChartData[];
  showBudget?: boolean;
  showActual?: boolean;
  showPrevious?: boolean;
  height?: number;
  colors?: {
    budget?: string;
    actual?: string;
    previous?: string;
  };
  valueKey?: string;
  stacked?: boolean;
  /** Threshold value for conditional coloring (e.g., 100 for execution rate) */
  threshold?: number;
  /** Color for values exceeding the threshold */
  thresholdColor?: string;
  /** Unit suffix for tooltip (e.g., '%' for percentages) */
  unit?: string;
}

const defaultColors = {
  budget: '#94a3b8',
  actual: '#3b82f6',
  previous: '#f97316',
};

const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
];

export function BarChart({
  data,
  showBudget = true,
  showActual = true,
  showPrevious = false,
  height = 300,
  colors = defaultColors,
  valueKey,
  stacked = false,
  threshold,
  thresholdColor = '#ef4444',
  unit,
}: BarChartProps) {
  const formatYAxis = (value: number) => {
    if (unit) {
      return `${value}${unit}`;
    }
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(0)}억`;
    }
    if (value >= 10000) {
      return `${(value / 10000).toFixed(0)}만`;
    }
    return value.toLocaleString();
  };

  const formatTooltip = (value: number | string | readonly (string | number)[] | undefined) => {
    if (typeof value === 'number') {
      if (unit) {
        return `${value.toFixed(1)}${unit}`;
      }
      return `${value.toLocaleString()}원`;
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value ?? '');
  };

  // 단일 값 차트인 경우 (valueKey 사용)
  if (valueKey) {
    const getBarColor = (entry: BarChartData, index: number) => {
      if (threshold !== undefined && valueKey) {
        const value = entry[valueKey as keyof BarChartData];
        if (typeof value === 'number' && value > threshold) {
          return thresholdColor;
        }
      }
      return CHART_COLORS[index % CHART_COLORS.length];
    };

    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
          <XAxis type="number" tickFormatter={formatYAxis} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
          <Tooltip formatter={formatTooltip} />
          <Bar dataKey={valueKey} radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry, index)} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-45} textAnchor="end" height={80} />
        <YAxis tickFormatter={formatYAxis} />
        <Tooltip formatter={formatTooltip} />
        <Legend />
        {showBudget && (
          <Bar
            dataKey="budget"
            name="예산"
            fill={colors.budget}
            stackId={stacked ? 'stack' : undefined}
            radius={stacked ? undefined : [4, 4, 0, 0]}
          />
        )}
        {showActual && (
          <Bar
            dataKey="actual"
            name="실적"
            fill={colors.actual}
            stackId={stacked ? 'stack' : undefined}
            radius={stacked ? undefined : [4, 4, 0, 0]}
          />
        )}
        {showPrevious && (
          <Bar
            dataKey="previous"
            name="전년"
            fill={colors.previous}
            stackId={stacked ? 'stack' : undefined}
            radius={stacked ? undefined : [4, 4, 0, 0]}
          />
        )}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
