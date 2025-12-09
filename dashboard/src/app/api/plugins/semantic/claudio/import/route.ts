import { NextRequest, NextResponse } from 'next/server';
import { execSsearch, handleSemanticError, withTiming } from '../../client';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

interface ImportRequest {
  content: string;
  title?: string;
  tags?: string;
}

interface ImportResult {
  files_indexed: number;
  chunks_created: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const body = (await request.json()) as ImportRequest;

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  const tempFile = path.join(tmpdir(), `claudio-import-${Date.now()}.jsonl`);

  try {
    const doc = {
      content: body.content.trim(),
      url: `claudio://custom/${Date.now()}`,
      title: body.title || 'Custom Document',
    };

    await writeFile(tempFile, JSON.stringify(doc) + '\n');

    const tags = ['source:claudio', 'type:custom'];
    if (body.tags?.trim()) {
      tags.push(...body.tags.split(',').map((t) => t.trim()));
    }

    const result = await execSsearch<ImportResult>(
      ['import', tempFile, '--tags', tags.join(','), '--source', 'claudio', '--format', 'json'],
      { timeout: 30000 }
    );

    return NextResponse.json(withTiming(result, startTime));
  } catch (error) {
    return handleSemanticError(error);
  } finally {
    await unlink(tempFile).catch(() => {});
  }
}
