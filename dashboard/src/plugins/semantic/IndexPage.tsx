'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Loader2, Trash2, Database, Cpu, FileText, Tag as TagIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { transitions } from '@/lib/animations';
import { formatNumber, cn } from '@/lib/utils';
import { TagCloud } from './components';
import { getStatus, getTags, clearIndex } from './api';
import type { StatusResponse, Tag } from './types';

interface SourceSummary {
  name: string;
  count: number;
  topTags: string[];
}

function getSourceSummaries(tags: Tag[]): SourceSummary[] {
  const sources: Record<string, SourceSummary> = {};

  for (const tag of tags) {
    if (tag.tag.startsWith('source:')) {
      const name = tag.tag.replace('source:', '');
      sources[name] = { name, count: tag.count, topTags: [] };
    }
  }

  for (const tag of tags) {
    if (tag.tag.startsWith('space:')) {
      sources['confluence']?.topTags.push(tag.tag);
    } else if (tag.tag.startsWith('jira-project:')) {
      sources['jira']?.topTags.push(tag.tag);
    } else if (tag.tag.startsWith('type:agent-routing')) {
      if (!sources['claudio']) {
        sources['claudio'] = { name: 'claudio', count: tag.count, topTags: [] };
      }
      sources['claudio'].topTags.push(tag.tag);
    }
  }

  return Object.values(sources).sort((a, b) => b.count - a.count);
}

const sourceColors: Record<string, string> = {
  confluence: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  jira: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  claudio: 'bg-green-500/10 text-green-700 dark:text-green-400',
};

export function IndexPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statusRes, tagsRes] = await Promise.all([getStatus(), getTags()]);
      setStatus(statusRes);
      setTags(tagsRes.tags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClearIndex = async () => {
    setIsClearing(true);
    try {
      await clearIndex();
      await loadData();
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  const totalDocuments = status?.infra.qdrant.points ?? 0;
  const sourceSummaries = getSourceSummaries(tags);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Search Index" description="Monitor and manage the search index" />
        <Card>
          <CardContent className="py-6">
            <ErrorState description={error} onRetry={loadData} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search Index"
        description="Monitor and manage the search index"
        actions={
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.spring}
          className="space-y-6"
        >
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Documents</p>
                    <p className="text-2xl font-bold">{formatNumber(totalDocuments)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <TagIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tags</p>
                    <p className="text-2xl font-bold">{formatNumber(tags.length)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', status?.infra.qdrant.connected ? 'bg-green-500/10' : 'bg-red-500/10')}>
                    <Database className={cn('h-5 w-5', status?.infra.qdrant.connected ? 'text-green-600' : 'text-red-600')} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Qdrant</p>
                    <p className="text-sm font-medium">{status?.infra.qdrant.connected ? 'Connected' : 'Disconnected'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', status?.infra.embedding.connected ? 'bg-green-500/10' : 'bg-red-500/10')}>
                    <Cpu className={cn('h-5 w-5', status?.infra.embedding.connected ? 'text-green-600' : 'text-red-600')} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Embedding</p>
                    <p className="text-sm font-medium truncate max-w-[120px]" title={status?.infra.embedding.model}>
                      {status?.infra.embedding.model?.split('/').pop() || 'Unknown'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sources Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sources</CardTitle>
            </CardHeader>
            <CardContent>
              {sourceSummaries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No documents indexed yet.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sourceSummaries.map((source) => (
                    <div
                      key={source.name}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="secondary"
                          className={cn('font-medium', sourceColors[source.name])}
                        >
                          {source.name}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{formatNumber(source.count)}</p>
                        <p className="text-xs text-muted-foreground">documents</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Tags</CardTitle>
                <span className="text-sm text-muted-foreground">
                  Click tag to filter search, click ✕ to delete
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {tags.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No tags found.</div>
              ) : (
                <TagCloud tags={tags} onDeleted={loadData} />
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                <div>
                  <p className="font-medium">Clear Entire Index</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all {formatNumber(totalDocuments)} documents
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={totalDocuments === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Index
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Clear entire index"
        description={`This will permanently delete all ${formatNumber(totalDocuments)} documents from the search index. This action cannot be undone.`}
        confirmText="Clear All"
        variant="destructive"
        onConfirm={handleClearIndex}
        isLoading={isClearing}
      />
    </div>
  );
}
