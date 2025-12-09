export interface InfraStatus {
  qdrant: {
    connected: boolean;
    points: number;
    url: string;
    collection: string;
  };
  embedding: {
    connected: boolean;
    model: string;
    url: string;
  };
}

export interface SourceInfo {
  name: 'confluence' | 'jira';
  available: boolean;
  description: string;
  version?: string;
}

export interface StatusResponse {
  infra: InfraStatus;
  sources: SourceInfo[];
}

export interface Tag {
  tag: string;
  count: number;
}

export interface TagsResponse {
  tags: Tag[];
  duration_ms: number;
}

export type SyncSource = 'confluence' | 'jira';
export type SyncMode = 'project' | 'query';

export interface SyncRequest {
  source: SyncSource;
  mode: SyncMode;
  project?: string;
  query?: string;
  limit?: number;
  fetchAll?: boolean;
  tags?: string;
  excludeAncestor?: string;
}

export interface SyncResult {
  files_scanned: number;
  files_indexed: number;
  files_skipped: number;
  chunks_created: number;
  duration_ms: number;
}

export interface SyncEvent {
  type: 'log' | 'result' | 'error' | 'done';
  message?: string;
  result?: SyncResult;
  success?: boolean;
  code?: number;
}

export interface ImportRequest {
  content: string;
  title?: string;
  tags?: string;
}

export interface ImportResult {
  files_indexed: number;
  chunks_created: number;
  duration_ms: number;
}

export interface DeleteResult {
  deleted: number;
  duration_ms: number;
}

export interface SearchResult {
  content: string;
  score: number;
  source?: {
    url?: string;
    title?: string;
  };
  tags: Array<{ key: string; value: string }>;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  duration_ms: number;
}

export interface SearchParams {
  query: string;
  tags?: string;
  limit?: number;
}
