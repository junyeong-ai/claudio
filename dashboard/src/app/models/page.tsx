'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton, SkeletonChart } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PeriodSelector } from '@/components/dashboard/period-selector';
import { PageHeader } from '@/components/ui/page-header';
import { useModelStats } from '@/hooks/use-stats';
import { useQueryParam } from '@/hooks/use-query-state';
import { staggerContainer, staggerItem, transitions } from '@/lib/animations';
import { formatNumber } from '@/lib/utils';
import type { Period } from '@/types/api';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { ExternalLink } from 'lucide-react';

const chartConfig: ChartConfig = { requests: { label: 'Requests' } };
const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

function ModelsPageContent() {
  const [period, setPeriod] = useQueryParam<Period>('period', '30d');
  const { data, isLoading } = useModelStats(period);

  const pieData = data?.models.map((model, index) => ({
    name: model.display_name,
    value: model.requests,
    fill: colors[index % colors.length],
  })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Models"
        description="Compare usage across Claude models"
        actions={<PeriodSelector value={period} onChange={setPeriod} />}
      />

      {isLoading ? (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <motion.div key={i} variants={staggerItem}>
              <Card><CardHeader><CardTitle>{i === 1 ? 'Usage Distribution' : 'Model Details'}</CardTitle></CardHeader><CardContent><Skeleton className="h-[280px] w-full" /></CardContent></Card>
            </motion.div>
          ))}
        </motion.div>
      ) : data?.models && data.models.length > 0 ? (
        <>
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 lg:grid-cols-2">
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader><CardTitle>Usage Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" labelLine={false} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
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
                <CardHeader><CardTitle>Model Details</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {data.models.map((model, index) => (
                    <Link key={model.model} href={`/history?model=${encodeURIComponent(model.model)}`} className="block">
                      <motion.div whileHover={{ x: 2 }} transition={transitions.fast} className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:border-primary/30 group">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                            <span className="font-medium group-hover:text-primary transition-colors">{model.display_name}</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-sm text-muted-foreground">{formatNumber(model.requests)} requests ({model.percentage.toFixed(1)}%)</p>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-sm font-medium">${model.cost_usd.toFixed(2)}</div>
                          <div className="text-xs text-muted-foreground">${model.cost_per_request.toFixed(4)}/req</div>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader><CardTitle>Performance Comparison</CardTitle></CardHeader>
              <CardContent>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left font-medium">Model</th>
                        <th className="py-2 text-right font-medium">Requests</th>
                        <th className="py-2 text-right font-medium">Avg Input</th>
                        <th className="py-2 text-right font-medium">Avg Output</th>
                        <th className="py-2 text-right font-medium">Latency</th>
                        <th className="py-2 text-right font-medium">Success</th>
                        <th className="py-2 text-right font-medium">Satisfaction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.models.map((model) => (
                        <Link key={model.model} href={`/history?model=${encodeURIComponent(model.model)}`} className="contents">
                          <motion.tr whileHover={{ backgroundColor: 'var(--muted)' }} className="border-b cursor-pointer group">
                            <td className="py-3 font-medium group-hover:text-primary transition-colors">{model.display_name}</td>
                            <td className="py-3 text-right">{formatNumber(model.requests)}</td>
                            <td className="py-3 text-right">{formatNumber(Math.round(model.avg_input_tokens))}</td>
                            <td className="py-3 text-right">{formatNumber(Math.round(model.avg_output_tokens))}</td>
                            <td className="py-3 text-right">{(model.avg_duration_ms / 1000).toFixed(1)}s</td>
                            <td className="py-3 text-right">
                              <Badge variant="secondary" className={model.success_rate >= 95 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}>{model.success_rate.toFixed(1)}%</Badge>
                            </td>
                            <td className="py-3 text-right">{model.satisfaction_rate ? `${model.satisfaction_rate.toFixed(1)}%` : '-'}</td>
                          </motion.tr>
                        </Link>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-3">
                  {data.models.map((model, index) => (
                    <Link key={model.model} href={`/history?model=${encodeURIComponent(model.model)}`} className="block">
                      <motion.div whileHover={{ scale: 1.01 }} className="rounded-lg border p-4 space-y-3 cursor-pointer hover:border-primary/30 group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                            <span className="font-medium group-hover:text-primary transition-colors">{model.display_name}</span>
                          </div>
                          <Badge variant="secondary" className={model.success_rate >= 95 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}>{model.success_rate.toFixed(1)}%</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-muted-foreground">Requests:</span> {formatNumber(model.requests)}</div>
                          <div><span className="text-muted-foreground">Latency:</span> {(model.avg_duration_ms / 1000).toFixed(1)}s</div>
                          <div><span className="text-muted-foreground">Input:</span> {formatNumber(Math.round(model.avg_input_tokens))}</div>
                          <div><span className="text-muted-foreground">Output:</span> {formatNumber(Math.round(model.avg_output_tokens))}</div>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      ) : (
        <Card><CardContent className="flex h-[200px] items-center justify-center text-muted-foreground">No model data available</CardContent></Card>
      )}
    </div>
  );
}

export default function ModelsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-10" />
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonChart height={280} />
          <SkeletonChart height={280} />
        </div>
      </div>
    }>
      <ModelsPageContent />
    </Suspense>
  );
}
