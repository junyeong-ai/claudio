import { NextRequest, NextResponse } from 'next/server';
import { fetchUser, handleSlackError, withTiming } from '../../client';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const startTime = Date.now();

  try {
    const user = await fetchUser(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(withTiming({ user }, startTime));
  } catch (error) {
    return handleSlackError(error);
  }
}
