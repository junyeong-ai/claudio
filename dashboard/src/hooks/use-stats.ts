'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  OverviewStats,
  TimeSeriesResponse,
  ModelsResponse,
  ErrorsResponse,
  WorkflowsResponse,
  SourcesResponse,
  RequestersResponse,
  RecentExecutionsResponse,
  ExecutionListResponse,
  ExecutionDetailResponse,
  FilterOptions,
  Period,
  Granularity,
  ClassifyStatsResponse,
  ClassifyLogsResponse,
} from '@/types/api';

export function useOverviewStats(period: Period = '24h', project?: string, source?: string) {
  const params = new URLSearchParams();
  params.set('period', period);
  if (project) params.set('project', project);
  if (source) params.set('source', source);

  return useQuery<OverviewStats>({
    queryKey: ['stats', 'overview', period, project, source],
    queryFn: () => api.get(`/v1/stats/overview?${params}`),
    refetchInterval: 30 * 1000,
    staleTime: 10 * 1000,
  });
}

export function useTimeSeries(
  granularity: Granularity = 'auto',
  from: string,
  to: string,
  project?: string,
  model?: string,
  source?: string
) {
  const params = new URLSearchParams();
  params.set('granularity', granularity);
  params.set('from', from);
  params.set('to', to);
  if (project) params.set('project', project);
  if (model) params.set('model', model);
  if (source) params.set('source', source);

  return useQuery<TimeSeriesResponse>({
    queryKey: ['stats', 'timeseries', granularity, from, to, project, model, source],
    queryFn: () => api.get(`/v1/stats/timeseries?${params}`),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });
}

export function useModelStats(period: Period = '30d', project?: string) {
  const params = new URLSearchParams();
  params.set('period', period);
  if (project) params.set('project', project);

  return useQuery<ModelsResponse>({
    queryKey: ['stats', 'models', period, project],
    queryFn: () => api.get(`/v1/stats/models?${params}`),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });
}

export function useErrorStats(period: Period = '7d', project?: string) {
  const params = new URLSearchParams();
  params.set('period', period);
  if (project) params.set('project', project);

  return useQuery<ErrorsResponse>({
    queryKey: ['stats', 'errors', period, project],
    queryFn: () => api.get(`/v1/stats/errors?${params}`),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });
}

export function useWorkflowStats(period: Period = '24h') {
  const params = new URLSearchParams();
  params.set('period', period);

  return useQuery<WorkflowsResponse>({
    queryKey: ['workflows', 'stats', period],
    queryFn: () => api.get(`/v1/workflows/stats?${params}`),
    refetchInterval: 30 * 1000,
    staleTime: 10 * 1000,
  });
}

export function useSourceStats(period: Period = '30d', project?: string) {
  const params = new URLSearchParams();
  params.set('period', period);
  if (project) params.set('project', project);

  return useQuery<SourcesResponse>({
    queryKey: ['stats', 'sources', period, project],
    queryFn: () => api.get(`/v1/stats/sources?${params}`),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });
}

export function useRequesterStats(
  period: Period = '30d',
  project?: string,
  source?: string,
  limit: number = 50
) {
  const params = new URLSearchParams();
  params.set('period', period);
  params.set('limit', limit.toString());
  if (project) params.set('project', project);
  if (source) params.set('source', source);

  return useQuery<RequestersResponse>({
    queryKey: ['stats', 'requesters', period, project, source, limit],
    queryFn: () => api.get(`/v1/stats/requesters?${params}`),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });
}

export function useRecentExecutions(limit: number = 10) {
  const params = new URLSearchParams();
  params.set('limit', limit.toString());

  return useQuery<RecentExecutionsResponse>({
    queryKey: ['executions', 'recent', limit],
    queryFn: () => api.get(`/v1/executions/recent?${params}`),
    refetchInterval: 15 * 1000,
    staleTime: 5 * 1000,
  });
}

export interface ExecutionFilters {
  project?: string;
  source?: string;
  model?: string;
  agent?: string;
  feedback?: number;
  requester?: string;
  channel?: string;
  from?: number;
  to?: number;
  search?: string;
  failed_only?: boolean;
}

export function useExecutionList(
  page: number = 1,
  limit: number = 20,
  filters: ExecutionFilters = {}
) {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', limit.toString());
  if (filters.project) params.set('project', filters.project);
  if (filters.source) params.set('source', filters.source);
  if (filters.model) params.set('model', filters.model);
  if (filters.agent) params.set('agent', filters.agent);
  if (filters.feedback !== undefined) params.set('feedback', filters.feedback.toString());
  if (filters.requester) params.set('requester', filters.requester);
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.from) params.set('from', filters.from.toString());
  if (filters.to) params.set('to', filters.to.toString());
  if (filters.search) params.set('search', filters.search);
  if (filters.failed_only) params.set('failed_only', 'true');

  return useQuery<ExecutionListResponse>({
    queryKey: ['executions', 'list', page, limit, filters],
    queryFn: () => api.get(`/v1/executions?${params}`),
    refetchInterval: 30 * 1000,
    staleTime: 10 * 1000,
  });
}

export function useExecutionDetail(id: string | null) {
  return useQuery<ExecutionDetailResponse>({
    queryKey: ['executions', 'detail', id],
    queryFn: () => api.get(`/v1/executions/${id}`),
    enabled: !!id,
  });
}

export function useFilterOptions() {
  return useQuery<FilterOptions>({
    queryKey: ['executions', 'filters'],
    queryFn: () => api.get('/v1/executions/filters'),
    staleTime: 60 * 1000,
  });
}

export function useClassifyStats(period: Period = '24h', project?: string) {
  const params = new URLSearchParams();
  params.set('period', period);
  if (project) params.set('project', project);

  return useQuery<ClassifyStatsResponse>({
    queryKey: ['classify', 'stats', period, project],
    queryFn: () => api.get(`/v1/classify/stats?${params}`),
    refetchInterval: 30 * 1000,
    staleTime: 10 * 1000,
  });
}

export interface ClassifyLogsFilters {
  project?: string;
  agent?: string;
  method?: string;
}

export function useClassifyLogs(
  period: Period = '24h',
  page: number = 1,
  limit: number = 20,
  filters: ClassifyLogsFilters = {}
) {
  const params = new URLSearchParams();
  params.set('period', period);
  params.set('page', page.toString());
  params.set('limit', limit.toString());
  if (filters.project) params.set('project', filters.project);
  if (filters.agent) params.set('agent', filters.agent);
  if (filters.method) params.set('method', filters.method);

  return useQuery<ClassifyLogsResponse>({
    queryKey: ['classify', 'logs', period, page, limit, filters],
    queryFn: () => api.get(`/v1/classify/logs?${params}`),
    refetchInterval: 30 * 1000,
    staleTime: 10 * 1000,
  });
}

export interface UserListItem {
  user_id: string;
  rule_count: number;
  has_summary: boolean;
  last_activity: number | null;
}

export interface UserContext {
  user_id: string;
  rules: string[];
  summary: string | null;
  last_summarized_at: number | null;
  recent_conversations: Array<{
    id: string;
    user_message: string;
    response: string | null;
    created_at: number;
    has_negative_feedback: boolean;
  }>;
  conversation_count: number;
  context_bytes: number;
  needs_summary: boolean;
  summary_locked: boolean;
  lock_id: string | null;
}

export function useUserList() {
  return useQuery<UserListItem[]>({
    queryKey: ['users', 'list'],
    queryFn: () => api.get('/v1/users'),
    refetchInterval: 30 * 1000,
    staleTime: 10 * 1000,
  });
}

export function useUserContext(userId: string | null) {
  return useQuery<UserContext>({
    queryKey: ['users', 'context', userId],
    queryFn: () => api.get(`/v1/users/${userId}/context`),
    enabled: !!userId,
    staleTime: 10 * 1000,
  });
}
