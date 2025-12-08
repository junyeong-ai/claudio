import { NextRequest, NextResponse } from 'next/server';
import { execSlackCli, handleSlackError, withTiming } from '../client';
import { type RawSlackChannel, mapRawChannel } from '../types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = searchParams.get('limit') || '10';

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    const rawChannels = await execSlackCli<RawSlackChannel[]>(
      `channels ${JSON.stringify(query)} --limit ${limit} -j`
    );

    return NextResponse.json(withTiming({
      channels: rawChannels.map(mapRawChannel),
      query,
    }, startTime));
  } catch (error) {
    return handleSlackError(error);
  }
}
