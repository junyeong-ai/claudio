'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  XAxis, YAxis, Line, LineChart, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { TimeSeriesPoint } from '@/types/api';
import { useMounted } from '@/hooks/use-mounted';

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  metrics: readonly (keyof TimeSeriesPoint)[];
  height?: number;
  type?: 'area' | 'bar' | 'line';
  className?: string;
}

const METRIC_CONFIG: Record<string, { label: string; color: string }> = {
  requests: { label: 'Requests', color: 'hsl(217, 91%, 60%)' },
  successful: { label: 'Successful', color: 'hsl(142, 71%, 45%)' },
  cost_usd: { label: 'Cost ($)', color: 'hsl(262, 83%, 58%)' },
  avg_duration_ms: { label: 'Avg Latency', color: 'hsl(24, 95%, 53%)' },
  positive_feedback: { label: 'Positive', color: 'hsl(142, 71%, 45%)' },
  negative_feedback: { label: 'Negative', color: 'hsl(0, 84%, 60%)' },
  input_tokens: { label: 'Input Tokens', color: 'hsl(199, 89%, 48%)' },
  output_tokens: { label: 'Output Tokens', color: 'hsl(270, 91%, 65%)' },
};

const COLORS = {
  light: {
    grid: 'hsl(0, 0%, 90%)',
    tick: 'hsl(0, 0%, 45%)',
    tooltipBg: 'hsl(0, 0%, 100%)',
    tooltipBorder: 'hsl(0, 0%, 90%)',
    tooltipText: 'hsl(0, 0%, 10%)',
  },
  dark: {
    grid: 'hsl(0, 0%, 25%)',
    tick: 'hsl(0, 0%, 60%)',
    tooltipBg: 'hsl(0, 0%, 15%)',
    tooltipBorder: 'hsl(0, 0%, 25%)',
    tooltipText: 'hsl(0, 0%, 90%)',
  },
};

function getConfig(metric: string) {
  return METRIC_CONFIG[metric] ?? { label: metric, color: 'hsl(217, 91%, 60%)' };
}

export function TimeSeriesChart({ data, metrics, height, type = 'area', className }: TimeSeriesChartProps) {
  const mounted = useMounted();
  const [chartHeight, setChartHeight] = useState(height ?? 350);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (height) return;
    const updateHeight = () => setChartHeight(window.innerWidth < 640 ? 250 : 350);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [height]);

  const colors = mounted ? COLORS[resolvedTheme === 'dark' ? 'dark' : 'light'] : COLORS.light;

  const formatXAxis = (value: string) => {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatYAxis = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  const formatTooltipLabel = (value: string) => new Date(value).toLocaleString();
  const formatTooltipValue = (value: number, name: string) => [value.toLocaleString(), getConfig(name).label];

  const axisProps = { tickLine: false, axisLine: false, fontSize: 12, tick: { fill: colors.tick } };
  const tooltipStyle = {
    backgroundColor: colors.tooltipBg,
    border: `1px solid ${colors.tooltipBorder}`,
    borderRadius: 8,
    color: colors.tooltipText,
  };
  const chartMargin = { top: 10, right: 10, left: 0, bottom: 0 };

  if (type === 'bar') {
    return (
      <div className={className} style={{ width: '100%', height: chartHeight }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
            <XAxis dataKey="timestamp" tickFormatter={formatXAxis} {...axisProps} />
            <YAxis tickFormatter={formatYAxis} width={50} {...axisProps} />
            <Tooltip formatter={formatTooltipValue} labelFormatter={formatTooltipLabel} contentStyle={tooltipStyle} />
            <Legend />
            {metrics.map((m) => (
              <Bar key={m} dataKey={m} name={getConfig(m as string).label} fill={getConfig(m as string).color} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'line') {
    return (
      <div className={className} style={{ width: '100%', height: chartHeight }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
            <XAxis dataKey="timestamp" tickFormatter={formatXAxis} {...axisProps} />
            <YAxis tickFormatter={formatYAxis} width={50} {...axisProps} />
            <Tooltip formatter={formatTooltipValue} labelFormatter={formatTooltipLabel} contentStyle={tooltipStyle} />
            <Legend />
            {metrics.map((m) => (
              <Line key={m} type="monotone" dataKey={m} name={getConfig(m as string).label} stroke={getConfig(m as string).color} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className={className} style={{ width: '100%', height: chartHeight }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={chartMargin}>
          <defs>
            {metrics.map((m) => (
              <linearGradient key={`gradient-${m}`} id={`gradient-${m}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={getConfig(m as string).color} stopOpacity={0.8} />
                <stop offset="95%" stopColor={getConfig(m as string).color} stopOpacity={0.1} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
          <XAxis dataKey="timestamp" tickFormatter={formatXAxis} {...axisProps} />
          <YAxis tickFormatter={formatYAxis} width={50} {...axisProps} />
          <Tooltip formatter={formatTooltipValue} labelFormatter={formatTooltipLabel} contentStyle={tooltipStyle} />
          <Legend />
          {metrics.map((m) => (
            <Area key={m} type="monotone" dataKey={m} name={getConfig(m as string).label} stroke={getConfig(m as string).color} fill={`url(#gradient-${m})`} strokeWidth={2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
