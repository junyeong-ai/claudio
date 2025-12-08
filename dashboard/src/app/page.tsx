'use client';

import { useMemo, Suspense } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Activity,
  DollarSign,
  Clock,
  ThumbsUp,
  TrendingUp,
  Zap,
  CheckCircle,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import { KPICard } from '@/components/dashboard/kpi-card';
import { PeriodSelector } from '@/components/dashboard/period-selector';
import { TimeSeriesChart } from '@/components/dashboard/time-series-chart';
import { SystemStats } from '@/components/dashboard/system-stats';
import { UserInsights } from '@/components/dashboard/user-insights';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton, SkeletonKPI, SkeletonChart } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { formatDuration } from '@/lib/utils';
import { RelativeTime } from '@/components/ui/relative-time';
import {
  useOverviewStats,
  useTimeSeries,
  useWorkflowStats,
  useModelStats,
  useRecentExecutions,
  useRequesterStats,
} from '@/hooks/use-stats';
import { useQueryParam } from '@/hooks/use-query-state';
import type { Period } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number | null | undefined, max: number = 100): string {
  if (value === null || value === undefined) return '-';
  const clamped = Math.min(Math.max(value, 0), max);
  return `${clamped.toFixed(1)}%`;
}

function OverviewPageContent() {
  const [period, setPeriod] = useQueryParam<Period>('period', '24h');

  const { from, to } = useMemo(() => {
    const now = new Date();
    const toDate = now.toISOString();
    const periodSeconds: Record<Period, number> = {
      '1h': 3600, '24h': 86400, '7d': 604800, '30d': 2592000, '90d': 7776000, all: 31536000,
    };
    const fromDate = new Date(now.getTime() - periodSeconds[period] * 1000).toISOString();
    return { from: fromDate, to: toDate };
  }, [period]);

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useOverviewStats(period);
  const { data: timeseries, isLoading: timeseriesLoading, error: timeseriesError, refetch: refetchTimeseries } = useTimeSeries('auto', from, to);
  const { data: workflows, isLoading: workflowsLoading, error: workflowsError, refetch: refetchWorkflows } = useWorkflowStats(period);
  const { data: models, isLoading: modelsLoading, error: modelsError, refetch: refetchModels } = useModelStats(period);
  const { data: recent, isLoading: recentLoading, error: recentError, refetch: refetchRecent } = useRecentExecutions(4);
  const { data: requesters, isLoading: requestersLoading, error: requestersError, refetch: refetchRequesters } = useRequesterStats(period, undefined, undefined, 5);

  const bottomLoading = workflowsLoading || modelsLoading || requestersLoading || statsLoading;
  const hasError = statsError || timeseriesError || workflowsError || modelsError || recentError || requestersError;

  const handleRetryAll = () => {
    refetchStats();
    refetchTimeseries();
    refetchWorkflows();
    refetchModels();
    refetchRecent();
    refetchRequesters();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Monitor your assistant-api performance"
        actions={<PeriodSelector value={period} onChange={setPeriod} />}
      />

      {hasError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <ErrorState
              title="Failed to load data"
              description="Some data couldn't be loaded. Check your connection and try again."
              onRetry={handleRetryAll}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KPICard title="Total Requests" value={stats?.summary.total_requests ?? 0} icon={Activity} change={stats?.comparison.requests_change_pct} loading={statsLoading} index={0} />
        <KPICard title="Success Rate" value={formatPercent(stats?.summary.success_rate)} icon={TrendingUp} loading={statsLoading} index={1} />
        <KPICard title="Total Cost" value={formatCurrency(stats?.summary.total_cost_usd ?? 0)} icon={DollarSign} change={stats?.comparison.cost_change_pct} invertTrend loading={statsLoading} index={2} />
        <KPICard title="Avg Latency" value={formatDuration(stats?.summary.avg_duration_ms ?? 0)} icon={Clock} change={stats?.comparison.duration_change_pct} invertTrend loading={statsLoading} index={3} />
        <KPICard title="Satisfaction" value={formatPercent(stats?.feedback.satisfaction_rate)} icon={ThumbsUp} change={stats?.comparison.satisfaction_change_pct} loading={statsLoading} index={4} />
        <KPICard title="Cache Hit Rate" value={formatPercent(stats?.summary.cache_hit_rate)} icon={Zap} loading={statsLoading} index={5} />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-4 lg:grid-cols-3"
      >
        <motion.div variants={staggerItem} className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Request Trend</CardTitle></CardHeader>
            <CardContent>
              {timeseriesLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : timeseries?.data && timeseries.data.length > 0 ? (
                <TimeSeriesChart data={timeseries.data} metrics={['requests', 'successful']} height={300} />
              ) : (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : recent?.executions && recent.executions.length > 0 ? (
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                  {recent.executions.map((exec) => (
                    <motion.div key={exec.id} variants={staggerItem}>
                      <Link
                        href={`/history?id=${exec.id}`}
                        className="flex items-start gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none transition-colors"
                      >
                        <div className="mt-0.5">
                          {exec.status === 'completed' ? (
                            exec.feedback === 1 ? <ThumbsUp className="h-4 w-4 text-green-500" /> :
                            exec.feedback === -1 ? <XCircle className="h-4 w-4 text-red-500" /> :
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : <XCircle className="h-4 w-4 text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-foreground">{exec.user_message_preview}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <RelativeTime timestamp={exec.created_at} />
                            {exec.cost_usd && <><span>•</span><span>${exec.cost_usd.toFixed(3)}</span></>}
                            {exec.duration_ms && <><span>•</span><span>{formatDuration(exec.duration_ms)}</span></>}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-muted-foreground">No recent activity</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-4 lg:grid-cols-2"
      >
        {bottomLoading ? (
          <>
            <motion.div variants={staggerItem}>
              <Card><CardHeader><CardTitle>System Stats</CardTitle></CardHeader><CardContent><Skeleton className="h-[180px] w-full" /></CardContent></Card>
            </motion.div>
            <motion.div variants={staggerItem}>
              <Card><CardHeader><CardTitle>User Insights</CardTitle></CardHeader><CardContent><Skeleton className="h-[180px] w-full" /></CardContent></Card>
            </motion.div>
          </>
        ) : (
          <>
            <motion.div variants={staggerItem}>
              <SystemStats workflows={workflows?.workflows ?? []} models={models?.models ?? []} />
            </motion.div>
            <motion.div variants={staggerItem}>
              <UserInsights
                requesters={requesters?.requesters ?? []}
                feedback={stats?.feedback ?? { total_with_feedback: 0, positive: 0, negative: 0, satisfaction_rate: null, pending_feedback: 0 }}
              />
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-10" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonKPI key={i} />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonChart className="lg:col-span-2" height={300} />
          <Card className="h-full"><CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader><CardContent><Skeleton className="h-[200px]" /></CardContent></Card>
        </div>
      </div>
    }>
      <OverviewPageContent />
    </Suspense>
  );
}
