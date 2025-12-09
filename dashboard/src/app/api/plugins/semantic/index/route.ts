import { NextResponse } from 'next/server';
import { execSsearch, handleSemanticError, withTiming } from '../client';

interface ClearResult {
  deleted: number;
}

export async function DELETE() {
  const startTime = Date.now();

  try {
    const result = await execSsearch<ClearResult>(
      ['index', 'clear', '-y', '--format', 'json'],
      { timeout: 300000 }
    );

    return NextResponse.json(withTiming(result, startTime));
  } catch (error) {
    return handleSemanticError(error);
  }
}
