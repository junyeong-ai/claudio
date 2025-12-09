import { NextRequest, NextResponse } from 'next/server';
import { execSsearch, handleSemanticError, withTiming } from '../../client';

interface DeleteResult {
  deleted: number;
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  const { tag } = await params;
  const startTime = Date.now();

  try {
    const result = await execSsearch<DeleteResult>([
      'tags',
      'delete',
      tag,
      '-y',
      '--format',
      'json',
    ]);

    return NextResponse.json(withTiming(result, startTime));
  } catch (error) {
    return handleSemanticError(error);
  }
}
