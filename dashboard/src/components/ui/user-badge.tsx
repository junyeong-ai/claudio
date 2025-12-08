'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { SlackUserBadge } from '@/plugins/slack/components';
import { isSlackUserId } from '@/plugins/slack/utils';

type NavigationTarget = 'context' | 'history';

interface UserBadgeProps {
  userId: string;
  showAvatar?: boolean;
  size?: 'xs' | 'sm' | 'md';
  navigate?: NavigationTarget;
  className?: string;
}

const sizeClasses = {
  xs: { avatar: 'h-4 w-4', text: 'text-xs' },
  sm: { avatar: 'h-5 w-5', text: 'text-sm' },
  md: { avatar: 'h-7 w-7', text: 'text-sm' },
};

const AVATAR_COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash = hash & hash;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(id: string): string {
  return id.slice(0, 2).toUpperCase();
}

function getNavigationHref(userId: string, target: NavigationTarget): string {
  return target === 'context'
    ? `/users?user=${encodeURIComponent(userId)}`
    : `/history?requester=${encodeURIComponent(userId)}`;
}

function GenericUserContent({
  userId,
  showAvatar,
  size,
  className,
}: {
  userId: string;
  showAvatar: boolean;
  size: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const { avatar: avatarClass, text: textClass } = sizeClasses[size];

  return (
    <span className={cn('inline-flex items-center gap-1.5', textClass, className)}>
      {showAvatar && (
        <Avatar className={avatarClass}>
          <AvatarFallback className={cn(getAvatarColor(userId), 'text-white text-[10px]')}>
            {getInitials(userId)}
          </AvatarFallback>
        </Avatar>
      )}
      <span className="truncate max-w-32 font-mono">{userId}</span>
    </span>
  );
}

export function UserBadge({
  userId,
  showAvatar = true,
  size = 'sm',
  navigate,
  className,
}: UserBadgeProps) {
  const isSlack = isSlackUserId(userId);

  if (isSlack && !navigate) {
    return (
      <SlackUserBadge
        userId={userId}
        showAvatar={showAvatar}
        size={size}
        clickable={true}
        className={className}
      />
    );
  }

  if (isSlack && navigate) {
    return (
      <Link
        href={getNavigationHref(userId, navigate)}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center hover:text-primary transition-colors"
      >
        <SlackUserBadge
          userId={userId}
          showAvatar={showAvatar}
          size={size}
          clickable={false}
          className={className}
        />
      </Link>
    );
  }

  const content = (
    <GenericUserContent
      userId={userId}
      showAvatar={showAvatar}
      size={size}
      className={className}
    />
  );

  if (!navigate) {
    return content;
  }

  return (
    <Link
      href={getNavigationHref(userId, navigate)}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center hover:text-primary transition-colors"
    >
      {content}
    </Link>
  );
}
