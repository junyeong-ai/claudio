'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps extends React.ComponentProps<'div'> {
  shimmer?: boolean;
}

function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        shimmer ? 'skeleton-shimmer' : 'animate-pulse',
        className
      )}
      {...props}
    />
  );
}

function SkeletonText({ className, lines = 1, ...props }: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full')}
        />
      ))}
    </div>
  );
}

function SkeletonAvatar({ className, size = 'md', ...props }: SkeletonProps & { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' };
  return <Skeleton className={cn('rounded-full', sizeClasses[size], className)} {...props} />;
}

function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)} {...props}>
      <div className="flex items-start gap-4">
        <SkeletonAvatar size="lg" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-32" />
          <SkeletonText lines={2} />
        </div>
      </div>
    </div>
  );
}

function SkeletonMessage({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-3', className)} {...props}>
      <div className="flex items-start gap-3">
        <SkeletonAvatar size="sm" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <SkeletonText lines={2} />
        </div>
      </div>
    </div>
  );
}

function SkeletonList({ count = 3, variant = 'card' }: { count?: number; variant?: 'card' | 'message' | 'simple' }) {
  const Component = variant === 'message' ? SkeletonMessage : variant === 'card' ? SkeletonCard : Skeleton;
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Component
          key={i}
          className={variant === 'simple' ? 'h-16 w-full' : undefined}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

function SkeletonKPI({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)} {...props}>
      <div className="flex items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

/** Matches AgentCard layout: header with icon/name + description + badges + keywords */
function SkeletonAgentCard({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn('rounded-lg border bg-card h-full', className)} {...props}>
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="flex items-center gap-0.5">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
        <Skeleton className="h-4 w-full mt-2" />
      </div>
      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-10 rounded-full" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-14" />
        </div>
      </div>
    </div>
  );
}

/** Matches ExecutionCard layout: message + response + badges + metadata */
function SkeletonExecutionCard({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)} {...props}>
      <div className="flex items-start gap-2 mb-3">
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-3/4 mb-4" />
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-10" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

function SkeletonChart({ className, height = 300, ...props }: SkeletonProps & { height?: number }) {
  return (
    <div className={cn('rounded-lg border bg-card', className)} {...props}>
      <div className="p-4 pb-2">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="p-4 pt-2">
        <Skeleton className="w-full" style={{ height }} />
      </div>
    </div>
  );
}

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonMessage,
  SkeletonList,
  SkeletonKPI,
  SkeletonChart,
  SkeletonAgentCard,
  SkeletonExecutionCard,
};
