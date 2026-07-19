/**
 * 파이/도넛 차트 컴포넌트
 */

'use client';

import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface PieChartData {
  name: string;
  value: number;
  color?: string;
  budget?: number;
  rate?: number;
}

interface PieChartProps {
  data: PieChartData[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  showLabel?: boolean;
  showCenterTotal?: boolean;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#84cc16', // lime
  '#6366f1', // indigo
];

// 커스텀 Tooltip 컴포넌트 (렌더링 외부에서 정의)
function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: PieChartData }[] }) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-900 mb-1">{item.name}</p>
        {item.budget !== undefined && (
          <p className="text-gray-600">예산: {item.budget.toLocaleString()}원</p>
        )}
        <p className="text-gray-900">결산: {item.value.toLocaleString()}원</p>
        {item.rate !== undefined && (
          <p className={`font-medium ${item.rate > 100 ? 'text-red-600' : 'text-brand-600'}`}>
            진척률: {item.rate.toFixed(1)}%
          </p>
        )}
      </div>
    );
  }
  return null;
}

export function PieChart({
  data,
  height = 300,
  innerRadius = 60,
  outerRadius = 100,
  showLegend = true,
  showLabel = false,
  showCenterTotal = false,
}: PieChartProps) {
  const hasBudgetInfo = data.some((d) => d.budget !== undefined);

  const renderCustomizedLabel = (props: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
    percent?: number;
    name?: string;
  }) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props;
    if (!cx || !cy || !midAngle || !innerRadius || !outerRadius || !percent) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // 5% 미만은 라벨 표시 안함

    return (
      <text
        x={x}
        y={y}
        fill="#374151"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={11}
      >
        {name} ({(percent * 100).toFixed(1)}%)
      </text>
    );
  };

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const totalBudget = data.reduce((sum, item) => sum + (item.budget || 0), 0);
  const totalRate = totalBudget > 0 ? (total / totalBudget * 100) : 0;

  // 커스텀 Legend
  const renderLegend = (props: { payload?: readonly { value?: string; color?: string }[] }) => {
    const { payload } = props;
    return (
      <ul className="text-xs space-y-1 max-h-[200px] overflow-y-auto">
        {payload?.map((entry, index) => {
          const item = data.find((d) => d.name === entry.value);
          const percent = item ? ((item.value / total) * 100).toFixed(1) : '0';
          return (
            <li key={`item-${index}`} className="flex items-start gap-1">
              <span
                className="inline-block w-3 h-3 rounded-full mt-0.5 flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-700">
                {entry.value} ({percent}%)
                {hasBudgetInfo && item?.rate !== undefined && (
                  <span className={`ml-1 ${item.rate > 100 ? 'text-red-600' : 'text-brand-600'}`}>
                    [{item.rate.toFixed(0)}%]
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={data}
          cx={showLegend ? '40%' : '50%'}
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey="value"
          label={showLabel ? renderCustomizedLabel : false}
          labelLine={showLabel}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        {showLegend && (
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            content={renderLegend}
          />
        )}
        {/* 중앙 합계 표시 */}
        {showCenterTotal && (
          <text
            x={showLegend ? '40%' : '50%'}
            y="45%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-500 text-[10px]"
          >
            {hasBudgetInfo ? '예산' : '합계'}
          </text>
        )}
        {showCenterTotal && hasBudgetInfo && (
          <text
            x={showLegend ? '40%' : '50%'}
            y="52%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-700 text-xs font-medium"
          >
            {(totalBudget / 100000000).toFixed(1)}억
          </text>
        )}
        {showCenterTotal && (
          <text
            x={showLegend ? '40%' : '50%'}
            y={hasBudgetInfo ? '62%' : '50%'}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-500 text-[10px]"
          >
            결산
          </text>
        )}
        {showCenterTotal && (
          <text
            x={showLegend ? '40%' : '50%'}
            y={hasBudgetInfo ? '69%' : '58%'}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-900 text-xs font-semibold"
          >
            {(total / 100000000).toFixed(1)}억
          </text>
        )}
        {showCenterTotal && hasBudgetInfo && (
          <text
            x={showLegend ? '40%' : '50%'}
            y="78%"
            textAnchor="middle"
            dominantBaseline="middle"
            className={`text-[10px] font-medium ${totalRate > 100 ? 'fill-red-600' : 'fill-brand-600'}`}
          >
            ({totalRate.toFixed(1)}%)
          </text>
        )}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}
