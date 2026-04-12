/**
 * 선형 차트 컴포넌트
 */

'use client';

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface LineChartData {
  name: string;
  income?: number;
  expense?: number;
  previousIncome?: number;
  previousExpense?: number;
  [key: string]: string | number | undefined;
}

interface LineConfig {
  dataKey: string;
  name: string;
  color: string;
  dashed?: boolean;
}

interface LineChartProps {
  data: LineChartData[];
  lines?: LineConfig[];
  showIncome?: boolean;
  showExpense?: boolean;
  showPrevious?: boolean;
  height?: number;
}

export function LineChart({
  data,
  lines,
  showIncome = true,
  showExpense = true,
  showPrevious = false,
  height = 300,
}: LineChartProps) {
  const formatYAxis = (value: number) => {
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
      return `${value.toLocaleString()}원`;
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value ?? '');
  };

  // 커스텀 라인 설정 사용
  if (lines) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={formatYAxis} />
          <Tooltip formatter={formatTooltip} />
          <Legend />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
              strokeDasharray={line.dashed ? '5 5' : undefined}
              dot={{ fill: line.color, strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis tickFormatter={formatYAxis} />
        <Tooltip formatter={formatTooltip} />
        <Legend />
        {showIncome && (
          <Line
            type="monotone"
            dataKey="income"
            name="수입"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
        )}
        {showExpense && (
          <Line
            type="monotone"
            dataKey="expense"
            name="지출"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ fill: '#ef4444', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
        )}
        {showPrevious && showIncome && (
          <Line
            type="monotone"
            dataKey="previousIncome"
            name="전년 수입"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        )}
        {showPrevious && showExpense && (
          <Line
            type="monotone"
            dataKey="previousExpense"
            name="전년 지출"
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        )}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
