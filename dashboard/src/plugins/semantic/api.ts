import type {
  SearchParams,
  SearchResponse,
  StatusResponse,
  TagsResponse,
  SyncRequest,
  SyncEvent,
  DeleteResult,
} from './types';

const API_BASE = '/api/plugins/semantic';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

async function* streamSSE<T>(response: Response): AsyncGenerator<T> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6)) as T;
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}

export async function searchDocuments(params: SearchParams): Promise<SearchResponse> {
  const searchParams = new URLSearchParams({
    q: params.query,
    limit: (params.limit ?? 10).toString(),
  });

  if (params.tags?.trim()) {
    searchParams.append('tags', params.tags);
  }

  return fetchJson(`${API_BASE}/search?${searchParams}`);
}

export async function getStatus(): Promise<StatusResponse> {
  return fetchJson(`${API_BASE}/status`);
}

export async function getTags(): Promise<TagsResponse> {
  return fetchJson(`${API_BASE}/tags`);
}

export async function deleteTag(tag: string): Promise<DeleteResult> {
  return fetchJson(`${API_BASE}/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' });
}

export async function deleteSource(source: 'confluence' | 'jira'): Promise<DeleteResult> {
  return fetchJson(`${API_BASE}/sources/${source}`, { method: 'DELETE' });
}

export async function clearIndex(): Promise<DeleteResult> {
  return fetchJson(`${API_BASE}/index`, { method: 'DELETE' });
}

export async function deleteClaudioData(): Promise<DeleteResult> {
  return fetchJson(`${API_BASE}/claudio`, { method: 'DELETE' });
}

export async function importDocument(request: {
  content: string;
  title?: string;
  tags?: string;
}): Promise<{ files_indexed: number; chunks_created: number; duration_ms: number }> {
  return fetchJson(`${API_BASE}/claudio/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export async function* syncAgents(): AsyncGenerator<SyncEvent> {
  const response = await fetch(`${API_BASE}/claudio/sync`, { method: 'POST' });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Sync failed' }));
    throw new Error(error.error || 'Sync failed');
  }

  yield* streamSSE<SyncEvent>(response);
}

export async function* syncSource(request: SyncRequest): AsyncGenerator<SyncEvent> {
  const response = await fetch(`${API_BASE}/sources/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Sync failed' }));
    throw new Error(error.error || 'Sync failed');
  }

  yield* streamSSE<SyncEvent>(response);
}

export type { SearchParams, SearchResponse } from './types';
