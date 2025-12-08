'use client';

import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FeedbackBadge } from '@/components/ui/feedback-badge';
import { Hash } from 'lucide-react';
import type { ExecutionDetail } from '@/types/api';
import { SlackChannelBadge } from '@/plugins/slack/components';
import { UserBadge } from '@/components/ui/user-badge';
import { formatNumber, formatDuration, formatModelName, formatDate } from '@/lib/utils';
import { ContentRenderer, detectFormat } from '@/lib/content';

interface ExecutionDetailModalProps {
  execution: ExecutionDetail | null;
  isLoading: boolean;
  open: boolean;
  onClose: () => void;
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function ExecutionDetailModal({ execution, isLoading, open, onClose }: ExecutionDetailModalProps) {
  const userMessage = execution?.user_message;
  const instruction = execution?.instruction;
  const userContext = execution?.user_context;
  const response = execution?.response;
  const metadataStr = execution?.metadata;

  const userMessageFormat = useMemo(() => (userMessage ? detectFormat(userMessage) : 'plain'), [userMessage]);
  const instructionFormat = useMemo(() => (instruction ? detectFormat(instruction) : 'plain'), [instruction]);
  const userContextFormat = useMemo(() => (userContext ? detectFormat(userContext) : 'plain'), [userContext]);
  const responseFormat = useMemo(() => (response ? detectFormat(response) : 'plain'), [response]);
  const metadata = useMemo(() => {
    if (!metadataStr) return null;
    try { return JSON.parse(metadataStr); } catch { return null; }
  }, [metadataStr]);

  const timestamp = execution ? execution.created_at * 1000 : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
          <SheetHeader className="px-6 py-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg">Execution Detail</SheetTitle>
              {execution?.feedback != null && (
                <FeedbackBadge feedback={execution.feedback as 1 | -1 | 0} showLabel={execution.feedback !== 0} />
              )}
            </div>
          </SheetHeader>
        </div>

        <div className="px-6 py-5">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : execution ? (
            <div className="space-y-5">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      {execution.requester && (
                        <UserBadge userId={execution.requester} size="sm" navigate="context" />
                      )}
                      {timestamp && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDate(timestamp, 'long')} {formatDate(timestamp, 'time')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {execution.model && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          {formatModelName(execution.model)}
                        </Badge>
                      )}
                      {metadata?.channel && (
                        execution.source === 'slack' ? (
                          <SlackChannelBadge channelId={metadata.channel} size="sm" />
                        ) : (
                          <Badge variant="outline" className="text-xs font-normal">
                            <Hash className="h-3 w-3 mr-0.5" />
                            {metadata.channel}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap">
                  {execution.cost_usd != null && (
                    <StatBadge label="Cost" value={`$${execution.cost_usd.toFixed(4)}`} />
                  )}
                  {execution.duration_ms != null && (
                    <StatBadge label="Duration" value={formatDuration(execution.duration_ms)} />
                  )}
                  {(execution.input_tokens || execution.output_tokens) && (
                    <StatBadge
                      label="Tokens"
                      value={`${formatNumber(execution.input_tokens ?? 0)} → ${formatNumber(execution.output_tokens ?? 0)}`}
                    />
                  )}
                </div>
              </div>

              <section>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold">User Message</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">
                    {userMessageFormat}
                  </Badge>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <ContentRenderer content={execution.user_message} format={userMessageFormat} />
                </div>
              </section>

              {instruction && (
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold">Instruction</h3>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">
                      {instructionFormat}
                    </Badge>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <ContentRenderer content={instruction} format={instructionFormat} />
                  </div>
                </section>
              )}

              {userContext && (
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold">User Context</h3>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">
                      {userContextFormat}
                    </Badge>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <ContentRenderer content={userContext} format={userContextFormat} />
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold">Response</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">
                    {responseFormat}
                  </Badge>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <ContentRenderer content={execution.response} format={responseFormat} />
                </div>
              </section>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              Execution not found
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
