'use client';

import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type FeedbackValue = 1 | -1 | 0 | null;

interface FeedbackBadgeProps {
  feedback: FeedbackValue;
  showLabel?: boolean;
  className?: string;
}

export function FeedbackBadge({ feedback, showLabel = false, className }: FeedbackBadgeProps) {
  if (feedback === 1) {
    return (
      <Badge
        className={`bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shrink-0 ${className ?? ''}`}
        aria-label="Positive feedback"
      >
        <ThumbsUp className="h-3 w-3" aria-hidden="true" />
        {showLabel && <span className="ml-1">Positive</span>}
      </Badge>
    );
  }

  if (feedback === -1) {
    return (
      <Badge
        className={`bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 shrink-0 ${className ?? ''}`}
        aria-label="Negative feedback"
      >
        <ThumbsDown className="h-3 w-3" aria-hidden="true" />
        {showLabel && <span className="ml-1">Negative</span>}
      </Badge>
    );
  }

  if (feedback === 0) {
    return (
      <div className={`flex gap-0.5 shrink-0 ${className ?? ''}`} role="group" aria-label="Mixed feedback">
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <ThumbsUp className="h-3 w-3" aria-hidden="true" />
        </Badge>
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <ThumbsDown className="h-3 w-3" aria-hidden="true" />
        </Badge>
      </div>
    );
  }

  return null;
}
