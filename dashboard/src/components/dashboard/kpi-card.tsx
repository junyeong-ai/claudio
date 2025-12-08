'use client';

import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/animations';
import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: number | null;
  changeLabel?: string;
  loading?: boolean;
  index?: number;
  invertTrend?: boolean; // For metrics where decrease is good (cost, latency)
}

export function KPICard({
  title,
  value,
  icon: Icon,
  change,
  changeLabel = 'vs last period',
  loading,
  index = 0,
  invertTrend = false,
}: KPICardProps) {
const getTrendColor = () => {
    if (change === undefined || change === null || change === 0)
      return 'text-muted-foreground';
    const isPositive = change > 0;
    const isGood = invertTrend ? !isPositive : isPositive;
    return isGood
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
  };

  const TrendIcon = change === undefined || change === null || change === 0
    ? Minus
    : change > 0 ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, ...transitions.spring }}
      whileHover={{ y: -2 }}
    >
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05 + 0.15 }}
              className="text-2xl font-bold tracking-tight"
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </motion.div>
          )}

          {change !== undefined && change !== null && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs mt-1',
                getTrendColor()
              )}
            >
              <TrendIcon className="h-3 w-3" />
              <span>
                {change > 0 ? '+' : ''}
                {change.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">{changeLabel}</span>
            </div>
          )}
        </CardContent>

        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-muted/5 pointer-events-none" />
      </Card>
    </motion.div>
  );
}
