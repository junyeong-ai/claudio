import { NextRequest, NextResponse } from 'next/server';
import { createSsearchStream } from '../../client';

interface SyncRequest {
  source: 'confluence' | 'jira';
  mode: 'project' | 'query';
  project?: string;
  query?: string;
  limit?: number;
  fetchAll?: boolean;
  tags?: string;
  excludeAncestor?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SyncRequest;

  if (!body.source || !['confluence', 'jira'].includes(body.source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  }

  if (body.mode === 'project' && !body.project) {
    return NextResponse.json({ error: 'Project key is required' }, { status: 400 });
  }

  if (body.mode === 'query' && !body.query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  const args = ['source', 'sync', body.source, '--format', 'json'];

  if (body.mode === 'project' && body.project) {
    args.push('--project', body.project);
  }

  if (body.mode === 'query' && body.query) {
    args.push('--query', body.query);
  }

  if (body.fetchAll) {
    args.push('--all');
  } else if (body.limit) {
    args.push('--limit', body.limit.toString());
  }

  if (body.tags) {
    args.push('--tags', body.tags);
  }

  if (body.source === 'confluence' && body.excludeAncestor) {
    args.push('--exclude-ancestor', body.excludeAncestor);
  }

  const stream = createSsearchStream(args);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
