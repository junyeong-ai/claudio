import { NextRequest, NextResponse } from 'next/server';
import { execSlackCli, handleSlackError, withTiming } from '../client';
import { type RawSlackUser, mapRawUser } from '../types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = searchParams.get('limit') || '10';

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    const rawUsers = await execSlackCli<RawSlackUser[]>(
      `users ${JSON.stringify(query)} --limit ${limit} --expand avatar,display_name,title,status,status_emoji,timezone,is_admin,is_bot,deleted -j`
    );

    return NextResponse.json(withTiming({
      users: rawUsers.map(mapRawUser),
      query,
    }, startTime));
  } catch (error) {
    return handleSlackError(error);
  }
}
