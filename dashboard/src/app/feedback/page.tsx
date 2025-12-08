'use client';

import { useMemo, Suspense } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton, SkeletonKPI, SkeletonChart } from '@/components/ui/skeleton';
import { PeriodSelector } from '@/components/dashboard/period-selector';
import { TimeSeriesChart } from '@/components/dashboard/time-series-chart';
import { PageHeader } from '@/components/ui/page-header';
import { useOverviewStats, useTimeSeries } from '@/hooks/use-stats';
import { useQueryParam } from '@/hooks/use-query-state';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { formatNumber } from '@/lib/utils';
import type { Period } from '@/types/api';
import { ThumbsUp, ThumbsDown, Clock, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

function FeedbackPageContent() {
  const [period, setPeriod] = useQueryParam<Period>('period', '7d');
  const { data: stats, isLoading: statsLoading } = useOverviewStats(period);

  const { from, to } = useMemo(() => {
    const now = new Date();
    const toDate = now.toISOString();
    const periodSeconds: Record<Period, number> = { '1h': 3600, '24h': 86400, '7d': 604800, '30d': 2592000, '90d': 7776000, all: 31536000 };
    const fromDate = new Date(now.getTime() - periodSeconds[period] * 1000).toISOString();
    return { from: fromDate, to: toDate };
  }, [period]);

  const { data: timeseries, isLoading: timeseriesLoading } = useTimeSeries('auto', from, to);

  const pieData = stats ? [
    { name: 'Positive', value: stats.feedback.positive, fill: '#22c55e' },
    { name: 'Negative', value: stats.feedback.negative, fill: '#ef4444' },
  ] : [];

  const totalFeedback = (stats?.feedback.positive ?? 0) + (stats?.feedback.negative ?? 0);
  const totalRequests = totalFeedback + (stats?.feedback.pending_feedback ?? 0);
  const coverageRate = totalRequests > 0 ? (totalFeedback / totalRequests) * 100 : 0;

  const statCards = [
    { title: 'Positive', icon: ThumbsUp, iconColor: 'text-green-500', value: stats?.feedback.positive ?? 0, textColor: 'text-green-600 dark:text-green-400' },
    { title: 'Negative', icon: ThumbsDown, iconColor: 'text-red-500', value: stats?.feedback.negative ?? 0, textColor: 'text-red-600 dark:text-red-400' },
    { title: 'Pending', icon: Clock, iconColor: 'text-muted-foreground', value: stats?.feedback.pending_feedback ?? 0, textColor: '' },
    { title: 'Satisfaction', icon: TrendingUp, iconColor: 'text-muted-foreground', value: stats?.feedback.satisfaction_rate ? `${stats.feedback.satisfaction_rate.toFixed(1)}%` : '-',
      textColor: (stats?.feedback.satisfaction_rate ?? 0) >= 70 ? 'text-green-600 dark:text-green-400' : (stats?.feedback.satisfaction_rate ?? 0) >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description="Track user satisfaction and feedback trends"
        actions={<PeriodSelector value={period} onChange={setPeriod} />}
      />

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {statCards.map((stat) => (
          <motion.div key={stat.title} variants={staggerItem} whileHover={{ y: -2 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </CardHeader>
              <CardContent>
                {statsLoading ? <Skeleton className="h-8 w-20" /> : <div className={`text-2xl font-bold ${stat.textColor}`}>{typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}</div>}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 lg:grid-cols-3">
        <motion.div variants={staggerItem} className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Feedback Trend</CardTitle></CardHeader>
            <CardContent>
              {timeseriesLoading ? <Skeleton className="h-[320px] w-full" /> : timeseries?.data && timeseries.data.length > 0 ? (
                <TimeSeriesChart data={timeseries.data} metrics={['positive_feedback', 'negative_feedback']} height={320} type="bar" />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-muted-foreground">No feedback data available for this period</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader><CardTitle>Distribution</CardTitle></CardHeader>
            <CardContent>
              {statsLoading ? <Skeleton className="h-[320px] w-full" /> : totalFeedback > 0 ? (
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="45%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[320px] items-center justify-center text-muted-foreground">No feedback data</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {stats && totalRequests > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader><CardTitle>Feedback Coverage</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{formatNumber(totalFeedback)} of {formatNumber(totalRequests)} requests have feedback</span>
                  <span className="font-medium">{coverageRate.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${coverageRate}%` }} transition={{ duration: 0.5, delay: 0.4 }} className="h-full bg-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-10" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <SkeletonKPI key={i} />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonChart className="lg:col-span-2" height={320} />
          <SkeletonChart height={320} />
        </div>
      </div>
    }>
      <FeedbackPageContent />
    </Suspense>
  );
}
