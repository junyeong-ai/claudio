'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WorkflowStats, ModelStats } from '@/types/api';
import { Activity, Cpu, CheckCircle, XCircle, AlertCircle, ChevronRight } from 'lucide-react';

interface SystemStatsProps {
  workflows: WorkflowStats[];
  models: ModelStats[];
}

const workflowStatusConfig = {
  healthy: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500' },
  degraded: { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-500' },
  critical: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500' },
} as const;

const modelColors = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
];

export function SystemStats({ workflows, models }: SystemStatsProps) {
  const hasWorkflows = workflows.length > 0;
  const hasModels = models.length > 0;

  if (!hasWorkflows && !hasModels) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            System Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No system data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          System Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasWorkflows && (
          <div className="space-y-3">
            <Link href="/workflows" className="flex items-center justify-between group">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                <Activity className="h-3.5 w-3.5" />
                Workflows
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <div className="space-y-2">
              {workflows.map((workflow) => {
                const config = workflowStatusConfig[workflow.status];
                return (
                  <div
                    key={workflow.name}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn('h-2 w-2 rounded-full', config.bg)} />
                      <span className="text-sm">{workflow.display_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {workflow.executions}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs',
                        workflow.success_rate >= 90
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                          : workflow.success_rate >= 70
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                      )}
                    >
                      {workflow.success_rate.toFixed(0)}%
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasWorkflows && hasModels && (
          <div className="border-t" />
        )}

        {hasModels && (
          <div className="space-y-3">
            <Link href="/models" className="flex items-center justify-between group">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                <Cpu className="h-3.5 w-3.5" />
                Models
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <div className="space-y-2.5">
              {models.map((model, index) => (
                <div key={model.model} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{model.display_name}</span>
                    <span className="text-muted-foreground">
                      {model.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        modelColors[index % modelColors.length]
                      )}
                      style={{ width: `${model.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
