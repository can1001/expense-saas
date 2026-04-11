/**
 * 복합 차트 컴포넌트 (막대 + 선)
 */

'use client';

import {
  ComposedChart as RechartsComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ComposedChartData {
  name: string;
  budget?: number;
  actual?: number;
  rate?: number;
  [key: string]: string | number | undefined;
}

interface ComposedChartProps {
  data: ComposedChartData[];
  bars?: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  lines?: Array<{
    dataKey: string;
    name: string;
    color: string;
    yAxisId?: string;
  }>;
  height?: number;
  showSecondYAxis?: boolean;
}

export function ComposedChart({
  data,
  bars = [
    { dataKey: 'budget', name: '예산', color: '#94a3b8' },
    { dataKey: 'actual', name: '실적', color: '#3b82f6' },
  ],
  lines = [{ dataKey: 'rate', name: '집행률', color: '#f97316', yAxisId: 'right' }],
  height = 300,
  showSecondYAxis = true,
}: ComposedChartProps) {
  const formatYAxis = (value: number) => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(0)}억`;
    }
    if (value >= 10000) {
      return `${(value / 10000).toFixed(0)}만`;
    }
    return value.toLocaleString();
  };

  const formatTooltip = (
    value: number | string | readonly (string | number)[] | undefined,
    name: string | number | undefined
  ) => {
    const nameStr = String(name ?? '');
    if (nameStr.includes('률') || nameStr.includes('rate')) {
      return typeof value === 'number' ? `${value.toFixed(1)}%` : String(value ?? '');
    }
    return typeof value === 'number' ? `${value.toLocaleString()}원` : String(value ?? '');
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-45} textAnchor="end" height={80} />
        <YAxis yAxisId="left" tickFormatter={formatYAxis} />
        {showSecondYAxis && (
          <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
        )}
        <Tooltip formatter={formatTooltip} />
        <Legend />
        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            yAxisId="left"
            dataKey={bar.dataKey}
            name={bar.name}
            fill={bar.color}
            radius={[4, 4, 0, 0]}
          />
        ))}
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            yAxisId={line.yAxisId || 'left'}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={{ fill: line.color, strokeWidth: 2 }}
          />
        ))}
      </RechartsComposedChart>
    </ResponsiveContainer>
  );
}
