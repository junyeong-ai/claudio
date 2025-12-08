'use client';

import { type ReactNode } from 'react';
import useSWR from 'swr';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useSlackContextOptional } from '../context';
import { isSlackChannelId } from '../utils';
import type { SlackChannel } from '../api';
import { Hash, Lock } from 'lucide-react';

interface SlackChannelBadgeProps {
  channelId: string;
  size?: 'xs' | 'sm' | 'md';
  fallback?: ReactNode;
  className?: string;
}

const sizeClasses = {
  xs: { icon: 'h-3 w-3', text: 'text-xs' },
  sm: { icon: 'h-3.5 w-3.5', text: 'text-sm' },
  md: { icon: 'h-4 w-4', text: 'text-sm' },
};

export function SlackChannelBadge({
  channelId,
  size = 'sm',
  fallback,
  className,
}: SlackChannelBadgeProps) {
  const ctx = useSlackContextOptional();
  const isSlack = isSlackChannelId(channelId);

  const { data: channel, isLoading } = useSWR<SlackChannel | null>(
    ctx && isSlack ? ['slack-channel', channelId] : null,
    () => ctx!.getChannel(channelId),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const { icon: iconClass, text: textClass } = sizeClasses[size];

  if (!ctx || !isSlack) {
    return (
      fallback ?? (
        <span className={cn('flex items-center gap-1 text-muted-foreground', className)}>
          <Hash className={iconClass} />
          <span>{channelId}</span>
        </span>
      )
    );
  }

  if (isLoading) {
    return <Skeleton className={cn('h-5 w-20', className)} />;
  }

  const Icon = channel?.is_private ? Lock : Hash;
  const name = channel?.name || channelId;

  return (
    <span className={cn('inline-flex items-center gap-1', textClass, className)}>
      <Icon className={cn(iconClass, 'shrink-0')} />
      <span className="truncate max-w-32">{name}</span>
    </span>
  );
}
