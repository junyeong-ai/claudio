'use client';

import { useCallback, Suspense } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton, SkeletonKPI, SkeletonChart } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PeriodSelector } from '@/components/dashboard/period-selector';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { SimplePagination } from '@/components/ui/pagination';
import { useErrorStats, useExecutionList, useExecutionDetail } from '@/hooks/use-stats';
import { useQueryState } from '@/hooks/use-query-state';
import { staggerContainer, staggerItem, transitions } from '@/lib/animations';
import { formatNumber, formatDuration, formatModelName } from '@/lib/utils';
import { RelativeTime } from '@/components/ui/relative-time';
import type { Period } from '@/types/api';
import { AlertTriangle, Clock, XCircle, TrendingDown, Calendar, User, Hash, CheckCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { ExecutionDetailModal } from '@/components/dashboard/execution-detail-modal';

const chartConfig: ChartConfig = { errors: { label: 'Errors' } };
const colors = ['var(--chart-5)', 'var(--chart-3)', 'var(--chart-2)', 'var(--chart-4)'];
const errorIcons: Record<string, typeof AlertTriangle> = { timeout: Clock, execution_error: XCircle, api_error: AlertTriangle };

function ErrorsPageContent() {
  const [queryState, setQueryState] = useQueryState({
    period: '7d' as Period,
    page: 1,
    id: '' as string | undefined,
  });

  const period = queryState.period as Period;
  const page = queryState.page;
  const selectedId = queryState.id || null;

  const { data, isLoading } = useErrorStats(period);
  const { data: errorLogs, isLoading: logsLoading } = useExecutionList(page, 10, { failed_only: true });
  const { data: detailData, isLoading: detailLoading } = useExecutionDetail(selectedId);

  const pieData = data?.errors.map((error, index) => ({ name: error.type, value: error.count, fill: colors[index % colors.length] })) ?? [];

  const statCards = [
    { title: 'Total Errors', icon: XCircle, iconColor: 'text-red-500', value: formatNumber(data?.total_errors ?? 0), textColor: 'text-red-600 dark:text-red-400' },
    { title: 'Error Rate', icon: TrendingDown, iconColor: 'text-muted-foreground', value: `${data?.error_rate.toFixed(2) ?? 0}%`, textColor: '' },
    { title: 'Error Types', icon: AlertTriangle, iconColor: 'text-yellow-500', value: formatNumber(data?.errors.length ?? 0), textColor: '' },
  ];

  const handlePageChange = useCallback((newPage: number) => setQueryState({ page: newPage }), [setQueryState]);
  const handlePeriodChange = useCallback((newPeriod: Period) => setQueryState({ period: newPeriod, page: 1 }), [setQueryState]);
  const handleSelectId = useCallback((id: string | null) => setQueryState({ id: id || undefined }), [setQueryState]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Errors"
        description="Analyze error patterns and types"
        actions={<PeriodSelector value={period} onChange={handlePeriodChange} />}
      />

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonKPI key={i} />)}
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {statCards.map((stat) => (
            <motion.div key={stat.title} variants={staggerItem} whileHover={{ y: -2 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonChart height={300} />
          <SkeletonChart height={300} />
        </div>
      ) : data && data.errors.length > 0 ? (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 lg:grid-cols-2">
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader><CardTitle>Error Distribution</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader><CardTitle>Error Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {data.errors.map((error, index) => {
                  const Icon = errorIcons[error.type] || AlertTriangle;
                  return (
                    <motion.div key={error.type} whileHover={{ x: 2 }} transition={transitions.fast} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: colors[index % colors.length] + '20' }}>
                          <Icon className="h-5 w-5" style={{ color: colors[index % colors.length] }} />
                        </div>
                        <div>
                          <p className="font-medium capitalize">{error.type?.replace('_', ' ') ?? 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{formatNumber(error.count)} occurrences</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">{error.percentage.toFixed(1)}%</Badge>
                        {error.trend && <p className="text-xs text-muted-foreground mt-1">{error.trend}</p>}
                      </div>
                    </motion.div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      ) : (
        <Card>
          <CardContent className="py-0">
            <EmptyState icon={CheckCircle} title="No errors found" description="All executions completed successfully in this period" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Error Logs</CardTitle>
          <div className="text-sm text-muted-foreground" aria-live="polite">{formatNumber(errorLogs?.total ?? 0)} total errors</div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : errorLogs?.executions && errorLogs.executions.length > 0 ? (
            <>
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                {errorLogs.executions.map((exec) => (
                  <motion.div
                    key={exec.id}
                    variants={staggerItem}
                    whileHover={{ x: 2 }}
                    transition={transitions.fast}
                    onClick={() => handleSelectId(exec.id)}
                    className="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 shrink-0">
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{exec.user_message_preview || 'No message'}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {exec.requester && <span className="flex items-center gap-1"><User className="h-3 w-3" />{exec.requester}</span>}
                          {exec.channel && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{exec.channel}</span>}
                          {exec.duration_ms && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(exec.duration_ms)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {exec.model && <Badge variant="outline" className="text-xs">{formatModelName(exec.model)}</Badge>}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap"><Calendar className="h-3 w-3" /><RelativeTime timestamp={exec.created_at} /></span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {errorLogs.total_pages > 1 && (
                <div className="mt-4 pt-4 border-t">
                  <SimplePagination
                    page={page}
                    hasMore={page < errorLogs.total_pages}
                    onPageChange={handlePageChange}
                    isLoading={logsLoading}
                  />
                </div>
              )}
            </>
          ) : (
            <EmptyState icon={CheckCircle} title="No error logs found" description="All executions completed successfully" />
          )}
        </CardContent>
      </Card>

      <ExecutionDetailModal execution={detailData?.execution ?? null} isLoading={detailLoading} open={!!selectedId} onClose={() => handleSelectId(null)} />
    </div>
  );
}

export default function ErrorsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-10" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonKPI key={i} />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonChart height={300} />
          <SkeletonChart height={300} />
        </div>
      </div>
    }>
      <ErrorsPageContent />
    </Suspense>
  );
}
