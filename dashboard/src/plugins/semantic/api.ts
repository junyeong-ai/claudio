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

export async function searchDocuments(params: SearchParams): Promise<SearchResponse> {
  const searchParams = new URLSearchParams({
    q: params.query,
    limit: (params.limit ?? 10).toString(),
  });

  if (params.tags?.trim()) {
    searchParams.append('tags', params.tags);
  }

  const response = await fetch(`/api/plugins/semantic/search?${searchParams}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Search failed' }));
    throw new Error(error.error || 'Search failed');
  }

  return response.json();
}
