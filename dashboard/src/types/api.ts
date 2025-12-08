// API Response Types

export interface OverviewStats {
  period: string;
  period_start: string;
  period_end: string;
  summary: SummaryStats;
  feedback: FeedbackSummary;
  comparison: ComparisonStats;
}

export interface SummaryStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  success_rate: number;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  cache_read_tokens: number;
  cache_hit_rate: number;
  avg_duration_ms: number;
  p50_duration_ms: number | null;
  p90_duration_ms: number | null;
  p95_duration_ms: number | null;
  p99_duration_ms: number | null;
}

export interface FeedbackSummary {
  total_with_feedback: number;
  positive: number;
  negative: number;
  satisfaction_rate: number | null;
  pending_feedback: number;
}

export interface ComparisonStats {
  requests_change_pct: number | null;
  cost_change_pct: number | null;
  duration_change_pct: number | null;
  satisfaction_change_pct: number | null;
}

export interface TimeSeriesPoint {
  timestamp: string;
  requests: number;
  successful: number;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  avg_duration_ms: number;
  p95_duration_ms: number | null;
  positive_feedback: number;
  negative_feedback: number;
}

export interface TimeSeriesResponse {
  granularity: string;
  from: string;
  to: string;
  data: TimeSeriesPoint[];
}

export interface ModelStats {
  model: string;
  display_name: string;
  requests: number;
  percentage: number;
  cost_usd: number;
  cost_per_request: number;
  avg_input_tokens: number;
  avg_output_tokens: number;
  avg_duration_ms: number;
  success_rate: number;
  satisfaction_rate: number | null;
}

export interface ModelsResponse {
  period: string;
  models: ModelStats[];
}

export interface ErrorBreakdown {
  type: string;
  count: number;
  percentage: number;
  trend?: string;
  affected_workflows?: string[];
}

export interface ErrorsResponse {
  period: string;
  total_errors: number;
  error_rate: number;
  errors: ErrorBreakdown[];
}

export interface WorkflowStats {
  name: string;
  display_name: string;
  status: 'healthy' | 'degraded' | 'critical';
  executions: number;
  successful: number;
  failed: number;
  success_rate: number;
  avg_duration_ms?: number;
  p95_duration_ms?: number;
  last_execution?: string;
  last_status?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowsResponse {
  period: string;
  workflows: WorkflowStats[];
}

export interface SourceStats {
  source: string;
  requests: number;
  percentage: number;
  cost_usd: number;
  avg_duration_ms: number;
  success_rate: number;
  satisfaction_rate: number | null;
  unique_requesters: number;
}

export interface SourcesResponse {
  period: string;
  sources: SourceStats[];
}

export interface RequesterStats {
  requester: string;
  source: string | null;
  requests: number;
  cost_usd: number;
  avg_duration_ms: number;
  success_rate: number;
  satisfaction_rate: number | null;
  last_active: string;
}

export interface RequestersResponse {
  period: string;
  requesters: RequesterStats[];
}

export interface RecentExecution {
  id: string;
  project: string;
  agent: string | null;
  requester: string | null;
  user_message_preview: string;
  status: string;
  cost_usd: number | null;
  duration_ms: number | null;
  feedback: number | null;
  created_at: number;
}

export interface RecentExecutionsResponse {
  executions: RecentExecution[];
}

export interface ExecutionListItem {
  id: string;
  project: string;
  agent: string | null;
  source: string | null;
  requester: string | null;
  user_message_preview: string;
  instruction_preview: string | null;
  response_preview: string;
  model: string | null;
  cost_usd: number | null;
  duration_ms: number | null;
  feedback: number | null;
  channel: string | null;
  created_at: number;
}

export interface ExecutionListResponse {
  executions: ExecutionListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ExecutionDetail {
  id: string;
  project: string;
  agent: string | null;
  source: string | null;
  requester: string | null;
  session_id: string | null;
  instruction: string | null;
  user_message: string;
  user_context: string | null;
  response: string;
  model: string | null;
  cost_usd: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_creation_tokens: number | null;
  duration_ms: number | null;
  duration_api_ms: number | null;
  feedback: number | null;
  metadata: string | null;
  created_at: number;
}

export interface ExecutionDetailResponse {
  execution: ExecutionDetail | null;
}

export interface FilterOptions {
  projects: string[];
  sources: string[];
  models: string[];
  agents: string[];
  requesters: string[];
  channels: string[];
}

export type Period = '1h' | '24h' | '7d' | '30d' | '90d' | 'all';
export type Granularity = 'auto' | 'hour' | 'day' | 'week';

export interface AgentClassifyStats {
  agent: string;
  count: number;
  percentage: number;
  avg_confidence: number;
  avg_duration_ms: number;
}

export interface MethodClassifyStats {
  method: string;
  count: number;
  percentage: number;
  avg_duration_ms: number;
}

export interface ClassifyStatsResponse {
  period: string;
  total_classifications: number;
  avg_duration_ms: number;
  agents: AgentClassifyStats[];
  methods: MethodClassifyStats[];
}

export interface ClassifyLogEntry {
  id: number;
  text_preview: string;
  agent: string;
  model: string | null;
  confidence: number;
  method: string;
  matched_keyword: string | null;
  reasoning: string | null;
  duration_ms: number;
  project: string | null;
  source: string | null;
  requester: string | null;
  created_at: string;
}

export interface ClassifyLogsResponse {
  logs: ClassifyLogEntry[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Project/Agent Management
export interface Project {
  id: string;
  name: string;
  working_dir: string;
  system_prompt?: string;
  allowed_tools?: string[];
  disallowed_tools?: string[];
  is_default: boolean;
  // Classify settings
  fallback_agent: string;
  classify_model: string;
  classify_timeout: number;
  // Rate limiting
  rate_limit_rpm: number;
  created_at: number;
  updated_at: number;
}

export interface Agent {
  id: string;
  project_id: string;
  name: string;
  description: string;
  model: string;
  priority: number;
  keywords: string[];
  examples: string[];
  instruction?: string;
  tools?: string[];
  timeout: number;
  static_response: boolean;
  isolated: boolean;
  created_at: number;
  updated_at: number;
}

export interface CreateProject {
  name: string;
  working_dir: string;
  system_prompt?: string;
  allowed_tools?: string[];
  disallowed_tools?: string[];
  is_default?: boolean;
  // Classify settings
  fallback_agent?: string;
  classify_model?: string;
  classify_timeout?: number;
  // Rate limiting
  rate_limit_rpm?: number;
}

export interface UpdateProject {
  name?: string;
  working_dir?: string;
  system_prompt?: string;
  allowed_tools?: string[];
  disallowed_tools?: string[];
  is_default?: boolean;
  // Classify settings
  fallback_agent?: string;
  classify_model?: string;
  classify_timeout?: number;
  // Rate limiting
  rate_limit_rpm?: number;
}

export interface CreateAgent {
  name: string;
  description: string;
  model?: string;
  priority?: number;
  keywords?: string[];
  examples?: string[];
  instruction?: string;
  tools?: string[];
  timeout?: number;
  static_response?: boolean;
  isolated?: boolean;
}

export interface UpdateAgent {
  name?: string;
  description?: string;
  model?: string;
  priority?: number;
  keywords?: string[];
  examples?: string[];
  instruction?: string;
  tools?: string[];
  timeout?: number;
  static_response?: boolean;
  isolated?: boolean;
}

export interface ClassifyTestResponse {
  agent: string;
  instruction?: string;
  model: string;
  allowed_tools?: string[];
  timeout: number;
  static_response?: string;
  confidence: number;
  reasoning?: string;
  method: string;
  matched_keyword?: string;
  duration_ms: number;
}
