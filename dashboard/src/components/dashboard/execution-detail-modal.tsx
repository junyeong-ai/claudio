'use client';

import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FeedbackBadge } from '@/components/ui/feedback-badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Hash, Info, Clock, Coins, Zap, ExternalLink } from 'lucide-react';
import type { ExecutionDetail } from '@/types/api';
import { SlackChannelBadge } from '@/plugins/slack/components';
import { UserBadge } from '@/components/ui/user-badge';
import { formatNumber, formatDuration, formatModelName, formatDate } from '@/lib/utils';
import { ContentRenderer, detectFormat } from '@/lib/content';
import { StructuredOutputSection } from './structured-output-section';

interface ExecutionDetailModalProps {
  execution: ExecutionDetail | null;
  isLoading: boolean;
  open: boolean;
  onClose: () => void;
}

function StatItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <div className="flex flex-col">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, link, truncate }: { label: string; value: string; mono?: boolean; link?: string; truncate?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          {value}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : truncate ? (
        <span className={`${mono ? 'font-mono text-xs' : 'font-medium'} truncate max-w-48 cursor-help`} title={value}>{value}</span>
      ) : (
        <span className={mono ? 'font-mono text-xs' : 'font-medium'}>{value}</span>
      )}
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
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    {execution.requester && (
                      <UserBadge userId={execution.requester} size="md" navigate="context" maxWidth="lg" />
                    )}
                  </div>
                  {timestamp && (
                    <span className="text-xs text-muted-foreground shrink-0 text-right">
                      {formatDate(timestamp, 'long')}<br />
                      <span className="text-foreground font-medium">{formatDate(timestamp, 'time')}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {execution.model && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {formatModelName(execution.model)}
                    </Badge>
                  )}
                  {execution.source && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {execution.source}
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
                  {(execution.agent || execution.project || execution.session_id || metadata?.workflow_execution_id || metadata?.user_name || metadata?.source_branch || metadata?.mr_iid || metadata?.jira_key) && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-primary hover:bg-muted transition-colors border border-transparent hover:border-border">
                          <Info className="h-3.5 w-3.5" />
                          <span>Details</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-4" align="start">
                        <h4 className="text-sm font-semibold mb-3">Execution Details</h4>
                        <div className="text-sm space-y-0.5">
                          {execution.agent && (
                            <DetailRow label="Agent" value={execution.agent} />
                          )}
                          {execution.project && (
                            <DetailRow label="Project" value={execution.project} />
                          )}
                          {metadata?.user_name && (
                            <DetailRow label="User" value={metadata.user_name} />
                          )}
                          {metadata?.source_branch && (
                            <DetailRow label="Branch" value={`${metadata.source_branch} → ${metadata.target_branch}`} mono truncate />
                          )}
                          {metadata?.mr_iid && (
                            <DetailRow label="MR" value={`!${metadata.mr_iid}`} link={metadata.mr_url} />
                          )}
                          {metadata?.jira_key && (
                            <DetailRow label="JIRA" value={metadata.jira_key} link={metadata.jira_url} />
                          )}
                          {metadata?.workflow_execution_id && (
                            <DetailRow label="Workflow" value={metadata.workflow_execution_id} mono truncate />
                          )}
                          <DetailRow label="Session" value={execution.session_id || '-'} mono truncate />
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t">
                  {execution.cost_usd != null && (
                    <StatItem icon={Coins} label="Cost" value={`$${execution.cost_usd.toFixed(4)}`} />
                  )}
                  {execution.duration_ms != null && (
                    <StatItem icon={Clock} label="Duration" value={formatDuration(execution.duration_ms)} />
                  )}
                  {(execution.input_tokens || execution.output_tokens) && (
                    <StatItem icon={Zap} label="Tokens" value={`${formatNumber(execution.input_tokens ?? 0)} → ${formatNumber(execution.output_tokens ?? 0)}`} />
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

              {execution.response && execution.response.trim() && (
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
              )}

              <StructuredOutputSection
                structuredOutput={execution.structured_output}
                defaultOpen={!execution.response?.trim()}
              />
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
