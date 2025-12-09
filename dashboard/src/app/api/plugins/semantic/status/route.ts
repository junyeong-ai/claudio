import { NextResponse } from 'next/server';
import { execSsearch, handleSemanticError } from '../client';

interface InfraStatus {
  qdrant: { connected: boolean; points: number; url: string; collection: string };
  embedding: { connected: boolean; model: string; url: string };
}

interface SourceStatus {
  name: string;
  available: boolean;
  description: string;
  version?: string;
}

export async function GET() {
  try {
    const [infra, allSources] = await Promise.all([
      execSsearch<InfraStatus>(['status', '--format', 'json']),
      execSsearch<SourceStatus[]>(['source', 'list', '--format', 'json']),
    ]);

    const sources = allSources.filter((s) => s.name === 'confluence' || s.name === 'jira');

    return NextResponse.json({ infra, sources });
  } catch (error) {
    return handleSemanticError(error);
  }
}
