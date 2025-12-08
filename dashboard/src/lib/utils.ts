import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '-';
  const clamped = Math.min(Math.max(value, 0), 100);
  return `${clamped.toFixed(decimals)}%`;
}

export function formatCurrency(value: number, decimals = 2): string {
  return `$${value.toFixed(decimals)}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(timestamp * 1000, 'short');
}

export function formatRelativeTimeFromDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  return formatRelativeTime(new Date(dateString).getTime() / 1000);
}

export function formatDate(timestamp: number, format: 'short' | 'long' | 'time' = 'short'): string {
  const date = new Date(timestamp);
  switch (format) {
    case 'short':
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    case 'long':
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    case 'time':
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function parseTimestamp(value: string | number | null | undefined): number {
  if (!value) return Date.now();

  const num = typeof value === 'string' ? Number(value) : value;

  if (isNaN(num)) {
    const parsed = Date.parse(value as string);
    return isNaN(parsed) ? Date.now() : parsed;
  }

  // Unix timestamp in seconds (before year 2100) vs milliseconds
  return num < 4102444800 ? num * 1000 : num;
}

export function formatModelName(model: string | null | undefined): string {
  if (!model) return '';
  return model.replace('claude-', '').replace(/-\d{8}$/, '');
}
