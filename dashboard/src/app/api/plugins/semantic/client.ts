import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';

const execAsync = promisify(exec);
const DEFAULT_TIMEOUT = 30000;

export class SemanticCliError extends Error {
  constructor(
    message: string,
    public readonly code: 'CLI_MISSING' | 'TIMEOUT' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'SemanticCliError';
  }
}

interface ExecOptions {
  timeout?: number;
}

export async function execSemanticCli<T>(
  command: string,
  options: ExecOptions = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT } = options;

  try {
    const { stdout, stderr } = await execAsync(`ssearch ${command}`, { timeout });

    if (stderr && !stdout) {
      throw new SemanticCliError('Command returned error', 'UNKNOWN');
    }

    return JSON.parse(stdout) as T;
  } catch (error) {
    if (error instanceof SemanticCliError) throw error;

    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        throw new SemanticCliError('ssearch not found', 'CLI_MISSING');
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

export function handleSemanticError(error: unknown): NextResponse {
  if (error instanceof SemanticCliError) {
    switch (error.code) {
      case 'CLI_MISSING':
        return NextResponse.json(
          { error: 'ssearch not found. Please install ssearch CLI.' },
          { status: 500 }
        );
      case 'TIMEOUT':
        return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
      default:
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Unknown error' },
    { status: 500 }
  );
}

export { withTiming } from '../../utils';
