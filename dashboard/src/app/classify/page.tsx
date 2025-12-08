'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PeriodSelector } from '@/components/dashboard/period-selector';
import { ProjectFilter } from '@/components/dashboard/project-filter';
import { PageHeader } from '@/components/ui/page-header';
import { useClassifyStats, useClassifyLogs } from '@/hooks/use-stats';
import { useProjects } from '@/hooks/use-agents';
import { staggerContainer, staggerItem, transitions } from '@/lib/animations';
import { cn, formatNumber } from '@/lib/utils';
import { RelativeTimeFromDate } from '@/components/ui/relative-time';
import type { Period } from '@/types/api';
import { Users, Zap, Clock, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const methodColors: Record<string, string> = {
  keyword: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  semantic: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  llm: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  fallback: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export default function ClassifyPage() {
  const [period, setPeriod] = useState<Period>('24h');
  const [page, setPage] = useState(1);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: stats, isLoading: statsLoading } = useClassifyStats(period, projectId);
  const { data: logs, isLoading: logsLoading } = useClassifyLogs(period, page, 15, { project: projectId });

  const statCards = [
    { title: 'Total Classifications', icon: Search, value: formatNumber(stats?.total_classifications ?? 0) },
    { title: 'Active Agents', icon: Users, value: formatNumber(stats?.agents?.length ?? 0) },
    { title: 'Avg Duration', icon: Clock, value: stats?.avg_duration_ms ? `${(stats.avg_duration_ms / 1000).toFixed(2)}s` : '-' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classification Audit"
        description="Monitor agent classification decisions"
        actions={
          <div className="flex items-center gap-2">
            <ProjectFilter
              projects={projects}
              isLoading={projectsLoading}
              value={projectId}
              onChange={(v) => { setProjectId(v); setPage(1); }}
            />
            <PeriodSelector value={period} onChange={setPeriod} />
          </div>
        }
      />

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {statsLoading ? (
          [1, 2, 3].map((i) => (
            <motion.div key={i} variants={staggerItem}>
              <Card><CardHeader className="pb-2"><Skeleton className="h-4 w-[100px]" /></CardHeader><CardContent><Skeleton className="h-8 w-[80px]" /></CardContent></Card>
            </motion.div>
          ))
        ) : (
          statCards.map((stat) => (
            <motion.div key={stat.title} variants={staggerItem} whileHover={{ y: -2 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stat.value}</div></CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 lg:grid-cols-2">
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader><CardTitle className="text-lg">Agent Distribution</CardTitle></CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : stats?.agents && stats.agents.length > 0 ? (
                <div className="space-y-3">
                  {stats.agents.map((agent) => (
                    <motion.div key={agent.agent} whileHover={{ x: 2 }} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{agent.agent}</span>
                        <Badge variant="outline" className="text-xs">{formatNumber(agent.count)}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${agent.percentage}%` }} transition={{ duration: 0.5, delay: 0.2 }} className="h-full bg-primary" />
                        </div>
                        <span className="text-sm text-muted-foreground w-12 text-right">{agent.percentage.toFixed(1)}%</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No data</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader><CardTitle className="text-lg">Method Distribution</CardTitle></CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : stats?.methods && stats.methods.length > 0 ? (
                <div className="space-y-3">
                  {stats.methods.map((method) => (
                    <motion.div key={method.method} whileHover={{ x: 2 }} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={cn('capitalize', methodColors[method.method])}>{method.method}</Badge>
                        <span className="text-sm text-muted-foreground">{formatNumber(Math.round(method.avg_duration_ms))}ms avg</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatNumber(method.count)}</span>
                        <span className="text-sm text-muted-foreground">({method.percentage.toFixed(1)}%)</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No data</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Classifications</CardTitle>
            {logs && logs.total_pages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm text-muted-foreground">{page} / {logs.total_pages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(logs.total_pages, p + 1))} disabled={page === logs.total_pages}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : logs?.logs && logs.logs.length > 0 ? (
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                {logs.logs.map((log) => (
                  <motion.div
                    key={log.id}
                    variants={staggerItem}
                    whileHover={{ x: 2 }}
                    transition={transitions.fast}
                    className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{log.text_preview}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary">{log.agent}</Badge>
                        <Badge className={cn('text-xs', methodColors[log.method])}>{log.method}</Badge>
                        {log.matched_keyword && <span className="text-xs text-muted-foreground">matched: &quot;{log.matched_keyword}&quot;</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-2"><Zap className="h-3 w-3 text-muted-foreground" /><span className="text-sm">{(log.confidence * 100).toFixed(0)}%</span></div>
                      <span className="text-xs text-muted-foreground">{formatNumber(log.duration_ms)}ms</span>
                      <RelativeTimeFromDate date={log.created_at} className="text-xs text-muted-foreground" />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No classification logs yet</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
