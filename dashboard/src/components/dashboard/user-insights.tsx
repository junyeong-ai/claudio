'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RequesterStats, FeedbackSummary } from '@/types/api';
import { Users, ThumbsUp, ThumbsDown, Clock, ChevronRight } from 'lucide-react';

interface UserInsightsProps {
  requesters: RequesterStats[];
  feedback: FeedbackSummary;
}

export function UserInsights({ requesters, feedback }: UserInsightsProps) {
  const hasRequesters = requesters.length > 0;
  const totalFeedback = feedback.positive + feedback.negative;
  const hasFeedback = totalFeedback > 0 || feedback.pending_feedback > 0;

  if (!hasRequesters && !hasFeedback) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No user data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          User Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasRequesters && (
          <div className="space-y-3">
            <Link href="/users" className="flex items-center justify-between group">
              <div className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Top Requesters
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <div className="space-y-2">
              {requesters.map((r, idx) => (
                <Link
                  key={r.requester}
                  href={`/history?requester=${encodeURIComponent(r.requester)}`}
                  className="flex items-center justify-between py-1 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-4">
                      {idx + 1}
                    </span>
                    <span className="text-sm truncate max-w-28">
                      {r.requester}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{r.requests}</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>${r.cost_usd.toFixed(2)}</span>
                    {r.satisfaction_rate !== null && (
                      <>
                        <span className="text-muted-foreground/50">•</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-xs px-1.5 py-0',
                            r.satisfaction_rate >= 70
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                          )}
                        >
                          {r.satisfaction_rate.toFixed(0)}%
                        </Badge>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {hasRequesters && hasFeedback && (
          <div className="border-t" />
        )}

        {hasFeedback && (
          <div className="space-y-3">
            <Link href="/feedback" className="flex items-center justify-between group">
              <div className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Feedback
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <ThumbsUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{feedback.positive}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ThumbsDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">{feedback.negative}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {feedback.pending_feedback}
                  </span>
                </div>
              </div>
              {feedback.satisfaction_rate !== null && (
                <Badge
                  variant="secondary"
                  className={cn(
                    feedback.satisfaction_rate >= 70
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                      : feedback.satisfaction_rate >= 50
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                  )}
                >
                  {feedback.satisfaction_rate.toFixed(0)}% satisfaction
                </Badge>
              )}
            </div>
            {totalFeedback > 0 && (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
                <div
                  className="h-full bg-green-500"
                  style={{
                    width: `${(feedback.positive / totalFeedback) * 100}%`,
                  }}
                />
                <div
                  className="h-full bg-red-500"
                  style={{
                    width: `${(feedback.negative / totalFeedback) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
