'use client';

import { useReducer, useEffect } from 'react';

function formatRelative(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatRelativeFromDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  return formatRelative(new Date(dateString).getTime() / 1000);
}

interface RelativeTimeProps {
  timestamp: number;
  className?: string;
}

export function RelativeTime({ timestamp, className }: RelativeTimeProps) {
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    const interval = setInterval(forceUpdate, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {formatRelative(timestamp)}
    </span>
  );
}

interface RelativeTimeFromDateProps {
  date: string | null | undefined;
  className?: string;
}

export function RelativeTimeFromDate({ date, className }: RelativeTimeFromDateProps) {
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    const interval = setInterval(forceUpdate, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {formatRelativeFromDate(date)}
    </span>
  );
}
