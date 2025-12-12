'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { SkeletonExecutionCard } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { ProjectFilter } from '@/components/dashboard/project-filter';
import { useExecutionList, useFilterOptions, useExecutionDetail } from '@/hooks/use-stats';
import { useProjects } from '@/hooks/use-agents';
import { useQueryState } from '@/hooks/use-query-state';
import { ExecutionDetailModal } from '@/components/dashboard/execution-detail-modal';
import { SlackChannelBadge } from '@/plugins/slack/components';
import { UserBadge } from '@/components/ui/user-badge';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { formatNumber, formatDuration, formatModelName } from '@/lib/utils';
import { RelativeTime } from '@/components/ui/relative-time';
import { ThumbsUp, ThumbsDown, Clock, DollarSign, X, MessageSquare, Calendar, Search, Filter, Loader2 } from 'lucide-react';
import { FeedbackBadge } from '@/components/ui/feedback-badge';

function cleanMessagePreview(message: string | null | undefined): string {
  if (!message) return '';
  return message
    .replace(/\[Slack Context\][\s\S]*?(?=\n\n|$)/gi, '')
    .replace(/•\s*Channel:\s*\S+/gi, '')
    .replace(/•\s*Thread:\s*\S+/gi, '')
    .replace(/•\s*User:\s*\S+/gi, '')
    .replace(/##\s*자동화\s*규칙[\s\S]*?(?=\n\n|$)/gi, '')
    .replace(/##\s*완료\s*조건[\s\S]*?(?=\n\n|$)/gi, '')
    .replace(/^\s*\n/gm, '')
    .trim();
}

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

interface FilterControlsProps {
  inSheet?: boolean;
  filterOptions: { sources?: string[]; models?: string[]; agents?: string[]; requesters: string[]; channels: string[] } | undefined;
  queryState: { source?: string; model?: string; agent?: string; feedback?: string; requester?: string; channel?: string };
  updateFilter: (key: string, value: string | number | undefined) => void;
  hasFilters: boolean;
  clearFilters: () => void;
}

function FilterControls({ inSheet = false, filterOptions, queryState, updateFilter, hasFilters, clearFilters }: FilterControlsProps) {
  return (
    <div className={inSheet ? 'space-y-4' : 'hidden md:flex md:flex-wrap md:items-center md:gap-3'}>
      {filterOptions?.sources && filterOptions.sources.length > 0 && (
        <Select value={queryState.source || 'all'} onValueChange={(v) => updateFilter('source', v)}>
          <SelectTrigger className={inSheet ? 'w-full' : 'w-[130px] h-9'}><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {filterOptions.sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {filterOptions?.models && filterOptions.models.length > 0 && (
        <Select value={queryState.model || 'all'} onValueChange={(v) => updateFilter('model', v)}>
          <SelectTrigger className={inSheet ? 'w-full' : 'w-[140px] h-9'}><SelectValue placeholder="Model" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {filterOptions.models.map((m) => <SelectItem key={m} value={m}>{formatModelName(m)}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {filterOptions?.agents && filterOptions.agents.length > 0 && (
        <Select value={queryState.agent || 'all'} onValueChange={(v) => updateFilter('agent', v)}>
          <SelectTrigger className={inSheet ? 'w-full' : 'w-[130px] h-9'}><SelectValue placeholder="Agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {filterOptions.agents.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Select value={queryState.feedback || 'all'} onValueChange={(v) => updateFilter('feedback', v)}>
        <SelectTrigger className={inSheet ? 'w-full' : 'w-[130px] h-9'}><SelectValue placeholder="Feedback" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All feedback</SelectItem>
          <SelectItem value="1"><span className="flex items-center gap-2"><ThumbsUp className="h-3 w-3 text-green-600" />Positive</span></SelectItem>
          <SelectItem value="-1"><span className="flex items-center gap-2"><ThumbsDown className="h-3 w-3 text-red-600" />Negative</span></SelectItem>
          <SelectItem value="0"><span className="flex items-center gap-2"><ThumbsUp className="h-3 w-3 text-green-600" /><ThumbsDown className="h-3 w-3 text-red-600" />Mixed</span></SelectItem>
        </SelectContent>
      </Select>
      <Select value={queryState.requester || 'all'} onValueChange={(v) => updateFilter('requester', v)}>
        <SelectTrigger className={inSheet ? 'w-full' : 'w-[150px] h-9'}><SelectValue placeholder="Requester" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All requesters</SelectItem>
          {filterOptions?.requesters.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={queryState.channel || 'all'} onValueChange={(v) => updateFilter('channel', v)}>
        <SelectTrigger className={inSheet ? 'w-full' : 'w-[150px] h-9'}><SelectValue placeholder="Channel" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All channels</SelectItem>
          {filterOptions?.channels.map((c) => <SelectItem key={c} value={c}>#{c}</SelectItem>)}
        </SelectContent>
      </Select>
      {inSheet && hasFilters && (
        <Button variant="outline" onClick={clearFilters} className="w-full">
          <X className="h-4 w-4 mr-2" />Clear all filters
        </Button>
      )}
    </div>
  );
}

function HistoryPageContent() {
  const [queryState, setQueryState, resetQueryState] = useQueryState({
    page: 1,
    search: '' as string | undefined,
    project: '' as string | undefined,
    source: '' as string | undefined,
    model: '' as string | undefined,
    agent: '' as string | undefined,
    feedback: '' as string | undefined,
    requester: '' as string | undefined,
    channel: '' as string | undefined,
    id: '' as string | undefined,
  });

  const selectedId = queryState.id || null;
  const [searchInput, setSearchInput] = useState(queryState.search || '');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const isSearching = searchInput !== (queryState.search || '');

  const filters = {
    ...(queryState.search && { search: queryState.search }),
    ...(queryState.project && { project: queryState.project }),
    ...(queryState.source && { source: queryState.source }),
    ...(queryState.model && { model: queryState.model }),
    ...(queryState.agent && { agent: queryState.agent }),
    ...(queryState.feedback && { feedback: parseInt(queryState.feedback) }),
    ...(queryState.requester && { requester: queryState.requester }),
    ...(queryState.channel && { channel: queryState.channel }),
  };

  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: filterOptions } = useFilterOptions();
  const { data, isLoading, error, refetch } = useExecutionList(queryState.page, 18, filters);
  const { data: detailData, isLoading: detailLoading } = useExecutionDetail(selectedId);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (queryState.search || '')) {
        setQueryState({ search: searchInput || undefined, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setQueryState, queryState.search]);

  const updateFilter = useCallback((key: string, value: string | number | undefined) => {
    const normalizedValue = value === 'all' ? undefined : value;
    setQueryState({ [key]: normalizedValue?.toString(), page: 1 });
  }, [setQueryState]);

  const removeFilter = useCallback((key: string) => {
    setQueryState({ [key]: undefined, page: 1 });
  }, [setQueryState]);

  const clearFilters = useCallback(() => {
    setSearchInput('');
    resetQueryState();
    setMobileFiltersOpen(false);
  }, [resetQueryState]);

  const activeFilters: ActiveFilter[] = [
    queryState.project && { key: 'project', label: 'Project', value: projects?.find(p => p.id === queryState.project)?.name || queryState.project },
    queryState.source && { key: 'source', label: 'Source', value: queryState.source },
    queryState.model && { key: 'model', label: 'Model', value: formatModelName(queryState.model) },
    queryState.agent && { key: 'agent', label: 'Agent', value: queryState.agent },
    queryState.feedback && { key: 'feedback', label: 'Feedback', value: queryState.feedback === '1' ? 'Positive' : queryState.feedback === '-1' ? 'Negative' : 'Mixed' },
    queryState.requester && { key: 'requester', label: 'Requester', value: queryState.requester },
    queryState.channel && { key: 'channel', label: 'Channel', value: `#${queryState.channel}` },
  ].filter(Boolean) as ActiveFilter[];

  const hasFilters = activeFilters.length > 0 || !!queryState.search;
  const filterCount = activeFilters.length + (queryState.search ? 1 : 0);

  const handlePageChange = useCallback((newPage: number) => {
    setQueryState({ page: newPage });
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setQueryState]);

  const filterControlsProps = { filterOptions, queryState, updateFilter, hasFilters, clearFilters };

  return (
    <div className="space-y-6">
      <PageHeader title="History" description="Browse all execution history" />

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            <ProjectFilter
              projects={projects}
              isLoading={projectsLoading}
              value={filters.project}
              onChange={(v) => updateFilter('project', v)}
            />
            <div className="relative flex-1 min-w-[180px] max-w-[300px]">
              {isSearching || isLoading ? (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
              <Input
                placeholder="Search prompts..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 h-9"
                aria-label="Search prompts"
              />
            </div>

            <FilterControls {...filterControlsProps} />

            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="md:hidden h-9">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {filterCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">{filterCount}</Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh]">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FilterControls inSheet {...filterControlsProps} />
                </div>
              </SheetContent>
            </Sheet>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="hidden md:flex h-9">
                <X className="h-4 w-4 mr-1" />Clear
              </Button>
            )}

            <div className="ml-auto flex items-center gap-2 text-sm" aria-live="polite" aria-atomic="true">
              <span className="font-medium">{formatNumber(data?.total ?? 0)}</span>
              <span className="text-muted-foreground">results</span>
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              {activeFilters.map((filter) => (
                <Badge
                  key={filter.key}
                  variant="secondary"
                  className="gap-1 pr-1 hover:bg-secondary/80 cursor-pointer"
                  onClick={() => removeFilter(filter.key)}
                >
                  <span className="text-muted-foreground">{filter.label}:</span>
                  <span>{filter.value}</span>
                  <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-transparent" aria-label={`Remove ${filter.label} filter`}>
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="py-0">
            <ErrorState
              title="Failed to load executions"
              description="Unable to fetch execution history. Please check your connection and try again."
              onRetry={() => refetch()}
            />
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonExecutionCard key={i} />)}
        </div>
      ) : data?.executions && data.executions.length > 0 ? (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.executions.map((exec) => (
            <motion.div key={exec.id} variants={staggerItem} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Card
                className="cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group overflow-hidden"
                onClick={() => setQueryState({ id: exec.id })}
              >
                <CardContent className="p-4 flex flex-col h-full">
                  <div className="flex items-start gap-2 mb-3">
                    <p className="text-sm font-medium line-clamp-2 flex-1 group-hover:text-primary transition-colors">
                      {cleanMessagePreview(exec.user_message_preview) || exec.user_message_preview}
                    </p>
                    <FeedbackBadge feedback={exec.feedback as 1 | -1 | 0 | null} />
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1 break-words">{exec.response_preview}</p>
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    {exec.model && <Badge variant="secondary" className="text-xs font-normal">{formatModelName(exec.model)}</Badge>}
                    {exec.cost_usd && <span className="flex items-center gap-1 text-muted-foreground"><DollarSign className="h-3 w-3" />{exec.cost_usd.toFixed(3)}</span>}
                    {exec.duration_ms && <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />{formatDuration(exec.duration_ms)}</span>}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
                    <div className="flex items-center gap-2 truncate">
                      {exec.channel && exec.source === 'slack' ? <SlackChannelBadge channelId={exec.channel} size="xs" /> : exec.channel ? <span className="truncate">#{exec.channel}</span> : null}
                      {exec.requester && <UserBadge userId={exec.requester} size="xs" showAvatar={false} navigate="context" />}
                      {!exec.channel && !exec.requester && <span className="text-muted-foreground/50">-</span>}
                    </div>
                    <span className="flex items-center gap-1 shrink-0"><Calendar className="h-3 w-3" /><RelativeTime timestamp={exec.created_at} /></span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <Card>
          <CardContent className="py-0">
            <EmptyState
              icon={MessageSquare}
              title="No executions found"
              description={hasFilters ? 'Try adjusting your filters' : 'Executions will appear here'}
              action={hasFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined}
            />
          </CardContent>
        </Card>
      )}

      {data && data.total_pages > 1 && (
        <Pagination
          page={queryState.page}
          totalPages={data.total_pages}
          onPageChange={handlePageChange}
          isLoading={isLoading}
          showFirstLast
          showPageJump
        />
      )}

      <ExecutionDetailModal
        execution={detailData?.execution ?? null}
        isLoading={detailLoading}
        open={!!selectedId}
        onClose={() => setQueryState({ id: undefined })}
      />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-10" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonExecutionCard key={i} />)}
        </div>
      </div>
    }>
      <HistoryPageContent />
    </Suspense>
  );
}
