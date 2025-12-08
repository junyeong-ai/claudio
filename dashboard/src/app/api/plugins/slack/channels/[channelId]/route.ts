import { NextRequest, NextResponse } from 'next/server';
import { execSlackCli, handleSlackError, withTiming } from '../../client';
import { type RawSlackChannel, mapRawChannel } from '../../types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const startTime = Date.now();

  try {
    const channels = await execSlackCli<RawSlackChannel[]>(
      `channels ${JSON.stringify(channelId)} --limit 1 -j`
    );

    const channel = channels.find(c => c.id === channelId);

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    return NextResponse.json(withTiming({
      channel: mapRawChannel(channel),
    }, startTime));
  } catch (error) {
    return handleSlackError(error);
  }
}
