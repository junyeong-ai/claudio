import { NextResponse } from 'next/server';
import { execSsearch, handleSemanticError, withTiming } from '../client';

interface Tag {
  tag: string;
  count: number;
}

export async function GET() {
  const startTime = Date.now();

  try {
    const tags = await execSsearch<Tag[]>(['tags', 'list', '--format', 'json']);

    return NextResponse.json(withTiming({ tags }, startTime));
  } catch (error) {
    return handleSemanticError(error);
  }
}
