'use client';

import { useState, useMemo, useCallback, Suspense } from 'react';
import { motion } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, FileText, ListChecks, Plus, Trash2, ChevronRight, ChevronLeft, RefreshCw, Search, X, SortAsc, SortDesc, Filter, History } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { useUserList, useUserContext, useExecutionDetail } from '@/hooks/use-stats';
import { ExecutionDetailModal } from '@/components/dashboard/execution-detail-modal';
import { useQueryState } from '@/hooks/use-query-state';
import { api } from '@/lib/api';
import { SlackUserBadge } from '@/plugins/slack/components';
import { isSlackUserId } from '@/plugins/slack/utils';
import { staggerContainer, staggerItem, transitions } from '@/lib/animations';
import { formatNumber, formatDateTime } from '@/lib/utils';
import { RelativeTime } from '@/components/ui/relative-time';

type SortField = 'user_id' | 'rule_count' | 'last_activity';
type SortOrder = 'asc' | 'desc';
type SummaryFilter = 'all' | 'with' | 'without';

const ITEMS_PER_PAGE = 10;

function UsersPageContent() {
  const queryClient = useQueryClient();
  const [queryState, setQueryState, resetQueryState] = useQueryState({
    page: 1,
    search: '' as string | undefined,
    filter: 'all' as string | undefined,
    sort: 'last_activity' as string | undefined,
    order: 'desc' as string | undefined,
    user: '' as string | undefined,
  });

  const [newRule, setNewRule] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [searchInput, setSearchInput] = useState(queryState.search || '');
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

  const selectedUser = queryState.user || null;
  const summaryFilter = (queryState.filter || 'all') as SummaryFilter;
  const sortField = (queryState.sort || 'last_activity') as SortField;
  const sortOrder = (queryState.order || 'desc') as SortOrder;
  const page = queryState.page;

  const { data: users, isLoading: usersLoading } = useUserList();
  const { data: context, isLoading: contextLoading } = useUserContext(selectedUser);
  const { data: executionDetail, isLoading: executionLoading } = useExecutionDetail(selectedExecutionId);

  const filteredAndSortedUsers = useMemo(() => {
    if (!users) return [];
    let result = [...users];
    const searchQuery = queryState.search || '';
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((u) => u.user_id.toLowerCase().includes(query));
    }
    if (summaryFilter === 'with') result = result.filter((u) => u.has_summary);
    else if (summaryFilter === 'without') result = result.filter((u) => !u.has_summary);
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'user_id': comparison = a.user_id.localeCompare(b.user_id); break;
        case 'rule_count': comparison = a.rule_count - b.rule_count; break;
        case 'last_activity':
          comparison = (a.last_activity ?? 0) - (b.last_activity ?? 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [users, queryState.search, summaryFilter, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedUsers, page]);

  const hasFilters = (queryState.search || '').trim() !== '' || summaryFilter !== 'all';

  const clearFilters = useCallback(() => { setSearchInput(''); resetQueryState(); }, [resetQueryState]);
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setQueryState({ search: value || undefined, page: 1 });
  }, [setQueryState]);
  const handleSummaryFilterChange = useCallback((value: SummaryFilter) => {
    setQueryState({ filter: value === 'all' ? undefined : value, page: 1 });
  }, [setQueryState]);
  const toggleSortOrder = useCallback(() => {
    setQueryState({ order: sortOrder === 'asc' ? 'desc' : 'asc' });
  }, [setQueryState, sortOrder]);
  const setSelectedUser = useCallback((userId: string | null) => {
    setQueryState({ user: userId || undefined });
  }, [setQueryState]);
  const setPage = useCallback((newPage: number) => {
    setQueryState({ page: newPage });
  }, [setQueryState]);
  const setSortField = useCallback((field: SortField) => {
    setQueryState({ sort: field === 'last_activity' ? undefined : field });
  }, [setQueryState]);

  const invalidateUserQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  }, [queryClient]);

  const handleAddRule = async () => {
    if (!selectedUser || !newRule.trim()) return;
    setIsAdding(true);
    try {
      await api.post(`/v1/users/${selectedUser}/rules`, { rule: newRule.trim() });
      setNewRule('');
      invalidateUserQueries();
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteRule = async (rule: string) => {
    if (!selectedUser) return;
    await api.delete(`/v1/users/${selectedUser}/rules`, { rule });
    invalidateUserQueries();
  };

  const stats = useMemo(() => {
    if (!users) return { total: 0, withSummary: 0, totalRules: 0, avgRules: 0 };
    return {
      total: users.length,
      withSummary: users.filter((u) => u.has_summary).length,
      totalRules: users.reduce((acc, u) => acc + u.rule_count, 0),
      avgRules: users.length > 0 ? (users.reduce((acc, u) => acc + u.rule_count, 0) / users.length).toFixed(1) : '0',
    };
  }, [users]);

  const statCards = [
    { title: 'Total Users', icon: Users, value: stats.total },
    { title: 'With Summary', icon: FileText, value: stats.withSummary },
    { title: 'Total Rules', icon: ListChecks, value: stats.totalRules },
    { title: 'Avg Rules/User', icon: ListChecks, value: stats.avgRules },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage user contexts and personalization rules"
        actions={
          <Button variant="outline" size="sm" onClick={invalidateUserQueries}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {statCards.map((stat) => (
          <motion.div key={stat.title} variants={staggerItem} whileHover={{ y: -2 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {usersLoading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold">{formatNumber(typeof stat.value === 'string' ? parseFloat(stat.value) : stat.value)}</div>}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={transitions.spring}>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>User List</CardTitle>
              <CardDescription>Select a user to view and manage their context</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
                <div className="relative flex-1 min-w-0 sm:min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search user ID..." value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9 h-9" aria-label="Search user ID" />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={summaryFilter} onValueChange={(v) => handleSummaryFilterChange(v as SummaryFilter)}>
                    <SelectTrigger className="flex-1 sm:w-[130px] h-9">
                      <Filter className="h-3.5 w-3.5 mr-2 shrink-0" />
                      <SelectValue placeholder="Summary" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      <SelectItem value="with">With summary</SelectItem>
                      <SelectItem value="without">No summary</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                    <SelectTrigger className="flex-1 sm:w-[130px] h-9"><SelectValue placeholder="Sort by" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_activity">Last activity</SelectItem>
                      <SelectItem value="user_id">User ID</SelectItem>
                      <SelectItem value="rule_count">Rule count</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={toggleSortOrder} aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}>
                    {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </Button>
                  {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 shrink-0"><X className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Clear</span></Button>}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{formatNumber(filteredAndSortedUsers.length)} user{filteredAndSortedUsers.length !== 1 ? 's' : ''}{hasFilters && ` (filtered from ${formatNumber(users?.length ?? 0)})`}</span>
                {totalPages > 1 && <span>Page {page} of {totalPages}</span>}
              </div>

              {usersLoading ? (
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <motion.div key={i} variants={staggerItem}><Skeleton className="h-14 w-full" /></motion.div>
                  ))}
                </motion.div>
              ) : paginatedUsers.length > 0 ? (
                <>
                  <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                    {paginatedUsers.map((user) => (
                      <motion.button
                        key={user.user_id}
                        variants={staggerItem}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setSelectedUser(user.user_id)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${selectedUser === user.user_id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                      >
                        <div className="flex flex-col items-start gap-1">
                          {isSlackUserId(user.user_id) ? <SlackUserBadge userId={user.user_id} size="sm" clickable={false} /> : <span className="font-mono text-sm">{user.user_id}</span>}
                          <div className="flex gap-1.5">
                            <Badge variant="secondary" className="text-xs">{user.rule_count} rule{user.rule_count !== 1 ? 's' : ''}</Badge>
                            {user.has_summary && <Badge variant="outline" className="text-xs">summary</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {user.last_activity ? <RelativeTime timestamp={user.last_activity} className="text-xs text-muted-foreground" /> : <span className="text-xs text-muted-foreground">-</span>}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) pageNum = i + 1;
                          else if (page <= 3) pageNum = i + 1;
                          else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                          else pageNum = page - 2 + i;
                          return <Button key={pageNum} variant={page === pageNum ? 'default' : 'ghost'} size="sm" className="w-9 h-9" onClick={() => setPage(pageNum)}>{pageNum}</Button>;
                        })}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  icon={Users}
                  title={hasFilters ? 'No users match your filters' : 'No users with context yet'}
                  action={hasFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined}
                  className="py-8"
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...transitions.spring, delay: 0.1 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {selectedUser ? (
                    <>Context: {isSlackUserId(selectedUser) ? <SlackUserBadge userId={selectedUser} size="md" /> : selectedUser}</>
                  ) : 'User Context'}
                </CardTitle>
                {selectedUser && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/history?requester=${encodeURIComponent(selectedUser)}`}>
                      <History className="mr-2 h-4 w-4" />
                      View all history
                    </Link>
                  </Button>
                )}
              </div>
              <CardDescription>{selectedUser ? 'View and manage user rules and summary' : 'Select a user to view their context'}</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedUser ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2" />
                  <p>Select a user from the list</p>
                </motion.div>
              ) : contextLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : context ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">Summary</h3>
                      <div className="flex gap-2">
                        {context.summary_locked && <Badge variant="secondary" className="text-xs">Syncing</Badge>}
                        {context.needs_summary && <Badge variant="destructive" className="text-xs">Needs Update</Badge>}
                      </div>
                    </div>
                    {context.summary ? (
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">{context.summary}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No summary yet</p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{formatNumber(context.conversation_count)}/{formatNumber(30)} conversations</span>
                      <span>{formatNumber(context.context_bytes)}/{formatNumber(8000)} bytes</span>
                      {context.last_summarized_at && <span>Last: <RelativeTime timestamp={context.last_summarized_at} /></span>}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-3">Rules ({formatNumber(context.rules.length)})</h3>
                    {context.rules.length > 0 ? (
                      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                        {context.rules.map((rule) => (
                          <motion.div key={rule} variants={staggerItem} whileHover={{ x: 2 }} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg group">
                            <span className="text-sm">{rule}</span>
                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0" onClick={() => handleDeleteRule(rule)} aria-label={`Delete rule: ${rule}`}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </motion.div>
                        ))}
                      </motion.div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No rules defined</p>
                    )}
                    <div className="flex gap-2 mt-4">
                      <Input placeholder="Add a new rule..." value={newRule} onChange={(e) => setNewRule(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddRule()} />
                      <Button onClick={handleAddRule} disabled={isAdding || !newRule.trim()} aria-label="Add rule"><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  {context.recent_conversations.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-3">Recent Requests ({formatNumber(context.recent_conversations.length)})</h3>
                      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2 max-h-96 overflow-y-auto">
                        {context.recent_conversations.map((conv) => (
                          <motion.button
                            key={conv.id}
                            variants={staggerItem}
                            whileHover={{ x: 2 }}
                            onClick={() => setSelectedExecutionId(conv.id)}
                            className="w-full text-left text-xs p-2 bg-muted/30 rounded border hover:bg-muted/50 transition-colors cursor-pointer"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="truncate flex-1 mr-2 text-foreground">{conv.user_message || '(Empty message)'}</span>
                              <span className="shrink-0 text-muted-foreground">{formatDateTime(conv.created_at * 1000)}</span>
                            </div>
                            {conv.has_negative_feedback && conv.response && (
                              <p className="line-clamp-2 text-muted-foreground mt-1 pl-2 border-l-2 border-destructive/50">{conv.response}</p>
                            )}
                          </motion.button>
                        ))}
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <ExecutionDetailModal
        execution={executionDetail?.execution ?? null}
        isLoading={executionLoading}
        open={!!selectedExecutionId}
        onClose={() => setSelectedExecutionId(null)}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-10" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    }>
      <UsersPageContent />
    </Suspense>
  );
}
