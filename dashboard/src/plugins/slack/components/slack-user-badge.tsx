'use client';

import { type ReactNode } from 'react';
import useSWR from 'swr';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useSlackContextOptional } from '../context';
import { getInitials, getAvatarColor, isSlackUserId } from '../utils';
import type { SlackUser } from '../api';

interface SlackUserBadgeProps {
  userId: string;
  showAvatar?: boolean;
  size?: 'xs' | 'sm' | 'md';
  clickable?: boolean;
  fallback?: ReactNode;
  className?: string;
}

const sizeClasses = {
  xs: { avatar: 'h-4 w-4', text: 'text-xs' },
  sm: { avatar: 'h-5 w-5', text: 'text-sm' },
  md: { avatar: 'h-7 w-7', text: 'text-sm' },
};

export function SlackUserBadge({
  userId,
  showAvatar = true,
  size = 'sm',
  clickable = true,
  fallback,
  className,
}: SlackUserBadgeProps) {
  const ctx = useSlackContextOptional();
  const isSlack = isSlackUserId(userId);

  const { data: user, isLoading } = useSWR<SlackUser | null>(
    ctx && isSlack ? ['slack-user', userId] : null,
    () => ctx!.getUser(userId),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  if (!ctx || !isSlack) {
    return fallback ?? <span className="text-muted-foreground">{userId}</span>;
  }

  if (isLoading) {
    return <Skeleton className={cn('h-5 w-16', className)} />;
  }

  if (!user) {
    return (
      <span className={cn('font-mono text-xs text-muted-foreground', className)}>
        {userId}
      </span>
    );
  }

  const displayName = user.display_name || user.real_name || user.name;
  const { avatar: avatarClass, text: textClass } = sizeClasses[size];

  const content = (
    <span className={cn('inline-flex items-center gap-1.5', textClass, className)}>
      {showAvatar && (
        <Avatar className={avatarClass}>
          <AvatarImage src={user.image_48} alt={displayName} />
          <AvatarFallback
            className={cn(getAvatarColor(userId), 'text-white text-[10px]')}
          >
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
      )}
      <span className="truncate max-w-32">{displayName}</span>
    </span>
  );

  if (clickable) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          ctx.showUserDetail(userId);
        }}
        className="inline-flex items-center hover:underline hover:text-primary transition-colors"
      >
        {content}
      </button>
    );
  }

  return content;
}
