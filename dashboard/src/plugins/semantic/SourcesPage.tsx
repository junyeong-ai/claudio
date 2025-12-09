'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Loader2, Play, Trash2, Plus, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { transitions } from '@/lib/animations';
import { formatNumber, cn } from '@/lib/utils';
import {
  getStatus,
  getTags,
  syncSource,
  deleteSource,
  syncAgents,
  importDocument,
  deleteClaudioData,
} from './api';
import type { StatusResponse, Tag, SyncSource, SyncResult } from './types';

function getSourceCount(tags: Tag[], source: string): number {
  if (source === 'claudio') {
    return tags.find((t) => t.tag.startsWith('project:'))?.count ?? 0;
  }
  return tags.find((t) => t.tag === `source:${source}`)?.count ?? 0;
}


function getRelatedTags(tags: Tag[], source: string): Tag[] {
  const filtered = tags.filter((t) => {
    if (source === 'confluence') return t.tag.startsWith('space:');
    if (source === 'jira')
      return t.tag.startsWith('jira-') && !t.tag.startsWith('jira-type:') && !t.tag.startsWith('jira-status:');
    if (source === 'claudio')
      return t.tag.startsWith('project:') || t.tag.startsWith('type:') || t.tag.startsWith('agent:');
    return false;
  });

  // Sort: project > type > others (by count desc within each group)
  if (source === 'claudio') {
    filtered.sort((a, b) => {
      const order = (tag: string) => {
        if (tag.startsWith('project:')) return 0;
        if (tag.startsWith('type:')) return 1;
        return 2;
      };
      const orderDiff = order(a.tag) - order(b.tag);
      return orderDiff !== 0 ? orderDiff : b.count - a.count;
    });
  }

  return filtered.slice(0, 6);
}

interface AtlassianTabProps {
  source: SyncSource;
  available: boolean;
  tags: Tag[];
  onRefresh: () => void;
}

function AtlassianTab({ source, available, tags, onRefresh }: AtlassianTabProps) {
  const isConfluence = source === 'confluence';
  const projectLabel = isConfluence ? 'Space Key' : 'Project Key';
  const queryLabel = isConfluence ? 'CQL Query' : 'JQL Query';
  const queryPlaceholder = isConfluence
    ? 'space = DEV AND label = "guide"'
    : 'project = AKIT AND status = Done';

  const [mode, setMode] = useState<'project' | 'query'>('project');
  const [projectKey, setProjectKey] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(100);
  const [fetchAll, setFetchAll] = useState(false);
  const [customTags, setCustomTags] = useState('');

  const [isSyncing, setIsSyncing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const sourceCount = getSourceCount(tags, source);
  const relatedTags = getRelatedTags(tags, source);

  const handleSync = useCallback(async () => {
    const isProjectMode = mode === 'project';
    const value = isProjectMode ? projectKey.trim() : query.trim();
    if (!value) return;

    setLogs([]);
    setResult(null);
    setError(null);
    setIsSyncing(true);

    try {
      for await (const event of syncSource({
        source,
        mode,
        project: isProjectMode ? value : undefined,
        query: !isProjectMode ? value : undefined,
        fetchAll: isProjectMode ? fetchAll : undefined,
        limit: isProjectMode && fetchAll ? undefined : limit,
        tags: customTags.trim() || undefined,
      })) {
        if (event.type === 'log' && event.message) {
          setLogs((prev) => [...prev, event.message!]);
        } else if (event.type === 'result' && event.result) {
          setResult(event.result);
        } else if (event.type === 'error' && event.message) {
          setError(event.message);
        }
      }
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [source, mode, projectKey, query, fetchAll, limit, customTags, onRefresh]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSource(source);
      onRefresh();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!available) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-muted-foreground">
            {source.charAt(0).toUpperCase() + source.slice(1)} integration is not available.
            <br />
            <span className="text-sm">Please check atlassian-cli installation.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Button
              variant={mode === 'project' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('project')}
              disabled={isSyncing}
            >
              By {projectLabel}
            </Button>
            <Button
              variant={mode === 'query' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('query')}
              disabled={isSyncing}
            >
              By {queryLabel}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'project' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{projectLabel}</Label>
                  <Input
                    placeholder={isConfluence ? 'common' : 'AKIT'}
                    value={projectKey}
                    onChange={(e) => setProjectKey(e.target.value)}
                    disabled={isSyncing}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Custom Tags (optional)</Label>
                  <Input
                    placeholder="team:platform"
                    value={customTags}
                    onChange={(e) => setCustomTags(e.target.value)}
                    disabled={isSyncing}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`fetchAll-${source}`}
                    checked={fetchAll}
                    onCheckedChange={(checked) => setFetchAll(checked === true)}
                    disabled={isSyncing}
                  />
                  <Label htmlFor={`fetchAll-${source}`} className="font-normal cursor-pointer">
                    Fetch all
                  </Label>
                </div>
                {!fetchAll && (
                  <div className="flex items-center gap-2">
                    <Label className="font-normal">Limit:</Label>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      className="w-20 h-8"
                      disabled={isSyncing}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{queryLabel}</Label>
                <Input
                  placeholder={queryPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isSyncing}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="font-normal">Limit:</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-20 h-8"
                  disabled={isSyncing}
                />
              </div>
            </>
          )}

          <Button
            onClick={handleSync}
            disabled={isSyncing || (mode === 'project' ? !projectKey.trim() : !query.trim())}
          >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {isSyncing ? 'Syncing...' : 'Start Sync'}
          </Button>

          {(logs.length > 0 || result || error) && (
            <div className="mt-4 bg-muted rounded-lg p-3 font-mono text-xs max-h-48 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap opacity-70">
                  {log}
                </div>
              ))}
              {result && (
                <div className="text-green-600 dark:text-green-400 font-medium">
                  ✓ Indexed {result.files_indexed} files ({result.chunks_created} chunks) in {result.duration_ms}ms
                </div>
              )}
              {error && <div className="text-destructive font-medium">✗ {error}</div>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Indexed</span>
            <Badge variant="secondary" className="text-lg px-3">
              {formatNumber(sourceCount)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sourceCount === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">No data indexed yet</div>
          ) : (
            <>
              {relatedTags.length > 0 && (
                <div className="space-y-2">
                  {relatedTags.map((tag) => (
                    <div key={tag.tag} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate mr-2">{tag.tag}</span>
                      <span className="font-medium">{formatNumber(tag.count)}</span>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Clear All Data
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Clear all ${source} data`}
        description={`This will delete all ${formatNumber(sourceCount)} ${source} documents. This action cannot be undone.`}
        confirmText="Clear All"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}

interface ClaudioTabProps {
  tags: Tag[];
  onRefresh: () => void;
}

function ClaudioTab({ tags, onRefresh }: ClaudioTabProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncSuccess, setSyncSuccess] = useState<boolean | null>(null);

  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [customTags, setCustomTags] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const sourceCount = getSourceCount(tags, 'claudio');
  const relatedTags = getRelatedTags(tags, 'claudio');

  const handleSyncAgents = useCallback(async () => {
    setSyncLogs([]);
    setSyncSuccess(null);
    setIsSyncing(true);

    try {
      for await (const event of syncAgents()) {
        if (event.type === 'log' && event.message) {
          setSyncLogs((prev) => [...prev, event.message!]);
        } else if (event.type === 'done') {
          setSyncSuccess(event.success ?? event.code === 0);
        } else if (event.type === 'error' && event.message) {
          setSyncLogs((prev) => [...prev, `Error: ${event.message}`]);
          setSyncSuccess(false);
        }
      }
      onRefresh();
    } catch (err) {
      setSyncLogs((prev) => [...prev, `Error: ${err instanceof Error ? err.message : 'Sync failed'}`]);
      setSyncSuccess(false);
    } finally {
      setIsSyncing(false);
    }
  }, [onRefresh]);

  const handleImport = useCallback(async () => {
    if (!content.trim()) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await importDocument({
        content: content.trim(),
        title: title.trim() || undefined,
        tags: customTags.trim() || undefined,
      });
      setImportResult(`✓ Indexed ${result.chunks_created} chunks in ${result.duration_ms}ms`);
      setContent('');
      setTitle('');
      setCustomTags('');
      onRefresh();
    } catch (err) {
      setImportResult(`✗ ${err instanceof Error ? err.message : 'Import failed'}`);
    } finally {
      setIsImporting(false);
    }
  }, [content, title, customTags, onRefresh]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteClaudioData();
      onRefresh();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {/* Sync Agents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Sync Agent Examples
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Re-index all agent examples from the database for semantic routing.
            </p>
            <Button onClick={handleSyncAgents} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {isSyncing ? 'Syncing...' : 'Sync Agents'}
            </Button>

            {syncLogs.length > 0 && (
              <div className="bg-muted rounded-lg p-3 font-mono text-xs max-h-48 overflow-y-auto">
                {syncLogs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {log}
                  </div>
                ))}
                {syncSuccess !== null && (
                  <div className={syncSuccess ? 'text-green-600 dark:text-green-400' : 'text-destructive'}>
                    {syncSuccess ? '✓ Sync completed' : '✗ Sync failed'}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Import Document */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Custom Document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Title (optional)</Label>
                <Input
                  placeholder="Document title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isImporting}
                />
              </div>
              <div className="space-y-2">
                <Label>Tags (optional)</Label>
                <Input
                  placeholder="category:guide,topic:api"
                  value={customTags}
                  onChange={(e) => setCustomTags(e.target.value)}
                  disabled={isImporting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Content (Markdown)</Label>
              <Textarea
                placeholder="Enter document content in Markdown format..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isImporting}
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={handleImport} disabled={isImporting || !content.trim()}>
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {isImporting ? 'Importing...' : 'Add Document'}
              </Button>
              {importResult && (
                <span
                  className={cn(
                    'text-sm',
                    importResult.startsWith('✓') ? 'text-green-600 dark:text-green-400' : 'text-destructive'
                  )}
                >
                  {importResult}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Indexed</span>
            <Badge variant="secondary" className="text-lg px-3">
              {formatNumber(sourceCount)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sourceCount === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">No data indexed yet</div>
          ) : (
            <>
              {relatedTags.length > 0 && (
                <div className="space-y-2">
                  {relatedTags.map((tag) => (
                    <div key={tag.tag} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate mr-2">{tag.tag}</span>
                      <span className="font-medium">{formatNumber(tag.count)}</span>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Clear All Data
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Clear all Claudio data"
        description={`This will delete all ${formatNumber(sourceCount)} Claudio documents including agent examples. This action cannot be undone.`}
        confirmText="Clear All"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}

export function SourcesPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const refreshTags = useCallback(async () => {
    try {
      const tagsRes = await getTags();
      setTags(tagsRes.tags);
    } catch {
      // Silent fail
    }
  }, []);

  const confluenceAvailable = status?.sources.find((s) => s.name === 'confluence')?.available ?? false;
  const jiraAvailable = status?.sources.find((s) => s.name === 'jira')?.available ?? false;
  const confluenceCount = getSourceCount(tags, 'confluence');
  const jiraCount = getSourceCount(tags, 'jira');
  const claudioCount = getSourceCount(tags, 'claudio');

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Data Sources" description="Sync documents from Confluence, Jira, and Claudio" />
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
        title="Data Sources"
        description="Sync documents from Confluence, Jira, and Claudio"
        actions={
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-80" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-64 lg:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.spring}
        >
          <Tabs defaultValue="confluence">
            <TabsList>
              <TabsTrigger value="confluence" className="gap-2">
                <span className={cn('h-2 w-2 rounded-full', confluenceAvailable ? 'bg-green-500' : 'bg-red-500')} />
                Confluence
                {confluenceCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {formatNumber(confluenceCount)}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="jira" className="gap-2">
                <span className={cn('h-2 w-2 rounded-full', jiraAvailable ? 'bg-green-500' : 'bg-red-500')} />
                Jira
                {jiraCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {formatNumber(jiraCount)}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="claudio" className="gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Claudio
                {claudioCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {formatNumber(claudioCount)}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="confluence" className="mt-6">
              <AtlassianTab source="confluence" available={confluenceAvailable} tags={tags} onRefresh={refreshTags} />
            </TabsContent>

            <TabsContent value="jira" className="mt-6">
              <AtlassianTab source="jira" available={jiraAvailable} tags={tags} onRefresh={refreshTags} />
            </TabsContent>

            <TabsContent value="claudio" className="mt-6">
              <ClaudioTab tags={tags} onRefresh={refreshTags} />
            </TabsContent>
          </Tabs>
        </motion.div>
      )}
    </div>
  );
}
