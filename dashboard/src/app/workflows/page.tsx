'use client';

import { Suspense } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PeriodSelector } from '@/components/dashboard/period-selector';
import { PageHeader } from '@/components/ui/page-header';
import { useWorkflowStats } from '@/hooks/use-stats';
import { useQueryParam } from '@/hooks/use-query-state';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { cn, formatNumber } from '@/lib/utils';
import { RelativeTimeFromDate } from '@/components/ui/relative-time';
import type { Period } from '@/types/api';
import { CheckCircle, XCircle, AlertCircle, Clock, Activity } from 'lucide-react';

const statusIcons = { healthy: CheckCircle, degraded: AlertCircle, critical: XCircle };
const statusColors = { healthy: 'text-green-500', degraded: 'text-yellow-500', critical: 'text-red-500' };

function WorkflowsPageContent() {
  const [period, setPeriod] = useQueryParam<Period>('period', '24h');
  const { data, isLoading } = useWorkflowStats(period);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        description="Monitor n8n workflow executions"
        actions={<PeriodSelector value={period} onChange={setPeriod} />}
      />

      {isLoading ? (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <motion.div key={i} variants={staggerItem}>
              <Card><CardHeader><Skeleton className="h-6 w-[150px]" /></CardHeader><CardContent><Skeleton className="h-[100px] w-full" /></CardContent></Card>
            </motion.div>
          ))}
        </motion.div>
      ) : data?.workflows && data.workflows.length > 0 ? (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.workflows.map((workflow) => {
            const StatusIcon = statusIcons[workflow.status];
            return (
              <motion.div key={workflow.name} variants={staggerItem}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-medium">{workflow.display_name}</CardTitle>
                    <StatusIcon className={cn('h-5 w-5', statusColors[workflow.status])} />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Executions</p>
                        <div className="flex items-center gap-1">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xl font-bold">{formatNumber(workflow.executions)}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Success Rate</p>
                        <Badge variant="secondary" className={cn(
                          workflow.success_rate >= 90 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          workflow.success_rate >= 70 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        )}>{workflow.success_rate.toFixed(1)}%</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /><span>{formatNumber(workflow.successful)} succeeded</span></div>
                      <div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-500" /><span>{formatNumber(workflow.failed)} failed</span></div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
                      {workflow.avg_duration_ms && (
                        <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /><span>{(workflow.avg_duration_ms / 1000).toFixed(1)}s avg</span></div>
                      )}
                      <RelativeTimeFromDate date={workflow.last_execution} className="text-xs" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <Card><CardContent className="flex h-[200px] items-center justify-center text-muted-foreground">No workflow data available</CardContent></Card>
      )}
    </div>
  );
}

export default function WorkflowsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-10" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-[150px]" /></CardHeader>
              <CardContent><Skeleton className="h-[100px] w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    }>
      <WorkflowsPageContent />
    </Suspense>
  );
}
