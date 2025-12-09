import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';

const execAsync = promisify(exec);
const DEFAULT_TIMEOUT = 30000;
const SYNC_TIMEOUT = 600000;

export class SemanticCliError extends Error {
  constructor(
    message: string,
    public readonly code: 'CLI_MISSING' | 'TIMEOUT' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'SemanticCliError';
  }
}

export async function execSsearch<T>(
  args: string[],
  options: { timeout?: number } = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT } = options;
  const command = `ssearch ${args.join(' ')}`;

  try {
    const { stdout, stderr } = await execAsync(command, { timeout });

    if (stderr && !stdout) {
      throw new SemanticCliError(stderr, 'UNKNOWN');
    }

    return JSON.parse(stdout) as T;
  } catch (error) {
    if (error instanceof SemanticCliError) throw error;

    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        throw new SemanticCliError('ssearch CLI not found', 'CLI_MISSING');
      }
      if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
        throw new SemanticCliError('Request timed out', 'TIMEOUT');
      }
    }

    throw new SemanticCliError(
      error instanceof Error ? error.message : 'Unknown error',
      'UNKNOWN'
    );
  }
}

export function createSsearchStream(args: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const child = spawn('ssearch', args, { timeout: SYNC_TIMEOUT });
      let resultBuffer = '';

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        resultBuffer += text;

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'log', message: text })}\n\n`)
        );
      });

      child.stderr.on('data', (data: Buffer) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'log', message: data.toString() })}\n\n`)
        );
      });

      child.on('error', (error) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
        );
        controller.close();
      });

      child.on('close', (code) => {
        try {
          const jsonMatch = resultBuffer.match(/\{[\s\S]*\}$/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'result', result })}\n\n`)
            );
          }
        } catch {
          // JSON 파싱 실패는 무시
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', code })}\n\n`)
        );
        controller.close();
      });
    },
  });
}

export function handleSemanticError(error: unknown): NextResponse {
  if (error instanceof SemanticCliError) {
    const status = error.code === 'TIMEOUT' ? 504 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Unknown error' },
    { status: 500 }
  );
}

export function withTiming<T extends object>(data: T, startTime: number): T & { duration_ms: number } {
  return { ...data, duration_ms: Date.now() - startTime };
}
