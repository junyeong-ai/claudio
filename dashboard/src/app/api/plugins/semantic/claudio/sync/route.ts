import { spawn } from 'child_process';
import path from 'path';

const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

export async function POST() {
  const encoder = new TextEncoder();
  const scriptPath = path.resolve(process.cwd(), '../scripts/sync-agents.sh');

  const stream = new ReadableStream({
    start(controller) {
      const child = spawn('bash', [scriptPath], {
        cwd: path.resolve(process.cwd(), '..'),
        timeout: 120000,
      });

      child.stdout.on('data', (data: Buffer) => {
        const text = stripAnsi(data.toString());
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'log', message: text })}\n\n`)
        );
      });

      child.stderr.on('data', (data: Buffer) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'log', message: stripAnsi(data.toString()) })}\n\n`)
        );
      });

      child.on('error', (error) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
        );
        controller.close();
      });

      child.on('close', (code) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', code, success: code === 0 })}\n\n`)
        );
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
