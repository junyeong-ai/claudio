'use client';

import { useMemo, Suspense } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton, SkeletonChart } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { TimeSeriesChart } from '@/components/dashboard/time-series-chart';
import { PeriodSelector } from '@/components/dashboard/period-selector';
import { PageHeader } from '@/components/ui/page-header';
import { useTimeSeries, useOverviewStats } from '@/hooks/use-stats';
import { useQueryParam } from '@/hooks/use-query-state';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { formatNumber } from '@/lib/utils';
import type { Period } from '@/types/api';

function formatDuration(ms: number) {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${formatNumber(Math.round(ms))}ms`;
}

function AnalyticsPageContent() {
  const [period, setPeriod] = useQueryParam<Period>('period', '7d');

  const { from, to } = useMemo(() => {
    const now = new Date();
    const toDate = now.toISOString();
    const periodSeconds: Record<Period, number> = {
      '1h': 3600, '24h': 86400, '7d': 604800, '30d': 2592000, '90d': 7776000, all: 31536000,
    };
    const fromDate = new Date(now.getTime() - periodSeconds[period] * 1000).toISOString();
    return { from: fromDate, to: toDate };
  }, [period]);

  const { data: stats, error: statsError, refetch: refetchStats } = useOverviewStats(period);
  const { data: timeseries, isLoading: timeseriesLoading, error: timeseriesError, refetch: refetchTimeseries } = useTimeSeries('auto', from, to);

  const hasError = statsError || timeseriesError;
  const handleRetry = () => {
    refetchStats();
    refetchTimeseries();
  };

  const chartConfigs = [
    { title: 'Request Volume', metrics: ['requests', 'successful'] as const, type: 'bar' as const },
    { title: 'Cost Trend', metrics: ['cost_usd'] as const, type: 'area' as const },
    { title: 'Latency Trend', metrics: ['avg_duration_ms'] as const, type: 'line' as const },
    { title: 'Token Usage', metrics: ['input_tokens', 'output_tokens'] as const, type: 'area' as const },
  ];

  const percentiles = [
    { label: 'P50', value: stats?.summary.p50_duration_ms },
    { label: 'P90', value: stats?.summary.p90_duration_ms },
    { label: 'P95', value: stats?.summary.p95_duration_ms },
    { label: 'P99', value: stats?.summary.p99_duration_ms },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Deep dive into usage patterns and performance metrics"
        actions={<PeriodSelector value={period} onChange={setPeriod} />}
      />

      {hasError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-0">
            <ErrorState
              title="Failed to load analytics"
              description="Unable to fetch analytics data. Please check your connection and try again."
              onRetry={handleRetry}
            />
          </CardContent>
        </Card>
      )}

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-4 lg:grid-cols-2"
      >
        {chartConfigs.map((config) => (
          <motion.div key={config.title} variants={staggerItem}>
            <Card>
              <CardHeader><CardTitle>{config.title}</CardTitle></CardHeader>
              <CardContent>
                {timeseriesLoading ? (
                  <Skeleton className="h-[280px] w-full" />
                ) : timeseries?.data && timeseries.data.length > 0 ? (
                  <TimeSeriesChart data={timeseries.data} metrics={config.metrics} height={280} type={config.type} />
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader><CardTitle>Latency Percentiles</CardTitle></CardHeader>
            <CardContent>
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid gap-4 grid-cols-2 md:grid-cols-4"
              >
                {percentiles.map((p) => (
                  <motion.div
                    key={p.label}
                    variants={staggerItem}
                    whileHover={{ scale: 1.02 }}
                    className="text-center p-4 rounded-lg bg-muted/50"
                  >
                    <p className="text-sm text-muted-foreground mb-1">{p.label}</p>
                    <p className="text-xl font-bold">{p.value ? formatDuration(p.value) : '-'}</p>
                  </motion.div>
                ))}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-10" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <SkeletonChart key={i} height={280} />)}
        </div>
      </div>
    }>
      <AnalyticsPageContent />
    </Suspense>
  );
}
