import { NextRequest, NextResponse } from 'next/server';
import { execSsearch, handleSemanticError, withTiming } from '../../client';

interface DeleteResult {
  deleted: number;
}

const VALID_SOURCES = ['confluence', 'jira'] as const;

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params;

  if (!VALID_SOURCES.includes(source as (typeof VALID_SOURCES)[number])) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    const result = await execSsearch<DeleteResult>(
      ['source', 'delete', source, '-y', '--format', 'json'],
      { timeout: 120000 }
    );

    return NextResponse.json(withTiming(result, startTime));
  } catch (error) {
    return handleSemanticError(error);
  }
}
