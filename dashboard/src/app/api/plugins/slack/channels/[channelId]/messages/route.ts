import { NextRequest, NextResponse } from 'next/server';
import { execSlackCli, enrichMessages, handleSlackError, withTiming } from '../../../client';
import type { RawSlackMessage } from '../../../types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '20';

  const startTime = Date.now();

  try {
    const rawMessages = await execSlackCli<RawSlackMessage[]>(
      `messages ${JSON.stringify(channelId)} --limit ${limit} -j`
    );

    const messages = await enrichMessages(rawMessages);

    return NextResponse.json(withTiming({
      messages,
      channel: channelId,
    }, startTime));
  } catch (error) {
    return handleSlackError(error);
  }
}
