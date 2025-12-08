import { NextRequest, NextResponse } from 'next/server';
import { execSemanticCli, handleSemanticError, withTiming } from '../client';

interface RawSearchResult {
  results?: Array<{
    content: string;
    score: number;
    source?: { url?: string; title?: string };
    tags: Array<{ key: string; value: string }>;
  }>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const tags = searchParams.get('tags');
  const limit = searchParams.get('limit') || '10';

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    const args = ['search', JSON.stringify(query), '--format', 'json', '--limit', limit];
    if (tags) args.push('--tags', tags);

    const raw = await execSemanticCli<RawSearchResult>(args.join(' '));

    return NextResponse.json(withTiming({
      results: raw.results || [],
      query,
    }, startTime));
  } catch (error) {
    return handleSemanticError(error);
  }
}
