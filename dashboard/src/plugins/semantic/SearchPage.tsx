'use client';

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Card, CardContent } from '@/components/ui/card';
import { escapeCustomTags } from '@/lib/content';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { cn, formatNumber } from '@/lib/utils';
import { staggerContainer, staggerItem, transitions } from '@/lib/animations';
import {
  Search,
  ExternalLink,
  SlidersHorizontal,
  Clock,
  FileText,
  AlertCircle,
  ChevronDown,
  Loader2,
  X,
} from 'lucide-react';
import { searchDocuments } from './api';
import type { SearchResult, SearchResponse } from './types';

const MAX_PREVIEW_LENGTH = 200;

export function SemanticSearchPage() {
  const searchParams = useSearchParams();
  const initialTags = searchParams.get('tags') || '';

  const [query, setQuery] = useState('');
  const [tags, setTags] = useState(initialTags);
  const [limit, setLimit] = useState(10);
  const [showFilters, setShowFilters] = useState(!!initialTags);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTags) {
      setTags(initialTags);
      setShowFilters(true);
    }
  }, [initialTags]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await searchDocuments({ query, tags, limit });
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [query, tags, limit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const clearTags = () => {
    setTags('');
    window.history.replaceState(null, '', '/plugins/semantic');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Semantic Search" description="Search documents using semantic similarity" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.spring}
      >
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  placeholder="Enter your search query..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9 text-base h-11"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => setShowFilters(!showFilters)}
                aria-label={showFilters ? 'Hide filters' : 'Show filters'}
                aria-expanded={showFilters}
              >
                <SlidersHorizontal
                  className={cn('h-4 w-4 transition-colors', showFilters && 'text-primary')}
                />
              </Button>
              <Button
                onClick={handleSearch}
                disabled={isLoading || !query.trim()}
                className="h-11 px-6"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
              </Button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-4 pt-2 border-t">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-sm text-muted-foreground mb-1.5 block">Tags</label>
                      <div className="relative">
                        <Input
                          placeholder="e.g., space:common"
                          value={tags}
                          onChange={(e) => setTags(e.target.value)}
                          className={tags ? 'pr-8' : ''}
                        />
                        {tags && (
                          <button
                            onClick={clearTags}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="w-24">
                      <label className="text-sm text-muted-foreground mb-1.5 block">Limit</label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {tags && !showFilters && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground">Filter:</span>
                <Badge variant="secondary" className="gap-1">
                  {tags}
                  <button onClick={clearTags} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {[1, 2, 3].map((i) => (
            <motion.div key={i} variants={staggerItem}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {results && !isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Found{' '}
              <span className="font-medium text-foreground">
                {formatNumber(results.results.length)}
              </span>{' '}
              results for &quot;{results.query}&quot;
              {tags && <span className="ml-1">with filter &quot;{tags}&quot;</span>}
            </span>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatNumber(results.duration_ms)}ms</span>
            </div>
          </div>

          {results.results.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No results found. Try a different query.</p>
              </CardContent>
            </Card>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {results.results.map((result, index) => (
                <motion.div key={index} variants={staggerItem}>
                  <ResultCard result={result} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      )}

      {!results && !isLoading && !error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Search className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground mb-1">
                Enter a search query to find similar documents
              </p>
              <p className="text-sm text-muted-foreground/70">Press Enter to search</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const needsTruncation = result.content.length > MAX_PREVIEW_LENGTH;
  const previewContent = needsTruncation
    ? result.content.slice(0, MAX_PREVIEW_LENGTH) + '...'
    : result.content;
  const scorePercent = Math.round(result.score * 100);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-muted/30"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${scorePercent} 100`}
                  className={cn(
                    scorePercent >= 80
                      ? 'text-green-500'
                      : scorePercent >= 60
                        ? 'text-blue-500'
                        : scorePercent >= 40
                          ? 'text-yellow-500'
                          : 'text-muted-foreground'
                  )}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                {scorePercent}
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {result.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {result.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-normal">
                    {tag.key}:{tag.value}
                  </Badge>
                ))}
              </div>
            )}

            <div className="text-sm text-foreground/90 leading-relaxed">
              <MarkdownContent>{isExpanded ? result.content : previewContent}</MarkdownContent>
            </div>

            <div className="flex items-center gap-3 mt-3">
              {needsTruncation && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')}
                  />
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
              {result.source?.url && (
                <a
                  href={result.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {result.source.title || 'Source'}
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MarkdownContent({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        p: ({ children }: { children?: ReactNode }) => (
          <p className="mb-2 last:mb-0">{children}</p>
        ),
        h1: ({ children }: { children?: ReactNode }) => (
          <h1 className="text-base font-bold mb-2">{children}</h1>
        ),
        h2: ({ children }: { children?: ReactNode }) => (
          <h2 className="text-sm font-bold mb-2">{children}</h2>
        ),
        h3: ({ children }: { children?: ReactNode }) => (
          <h3 className="text-sm font-semibold mb-1">{children}</h3>
        ),
        ul: ({ children }: { children?: ReactNode }) => (
          <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }: { children?: ReactNode }) => (
          <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>
        ),
        li: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
        code: ({ children }: { children?: ReactNode }) => (
          <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>
        ),
        pre: ({ children }: { children?: ReactNode }) => (
          <pre className="bg-muted p-3 rounded-lg overflow-x-auto mb-2 text-xs font-mono">
            {children}
          </pre>
        ),
        a: ({ href, children }: { href?: string; children?: ReactNode }) => (
          <a
            href={href}
            className="text-primary underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }: { children?: ReactNode }) => (
          <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground mb-2">
            {children}
          </blockquote>
        ),
        strong: ({ children }: { children?: ReactNode }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }: { children?: ReactNode }) => <em className="italic">{children}</em>,
      }}
    >
      {escapeCustomTags(children)}
    </ReactMarkdown>
  );
}
