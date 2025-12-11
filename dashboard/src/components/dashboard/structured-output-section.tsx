'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ContentRenderer, detectFormat, type ContentFormat } from '@/lib/content';
import { ChevronRight, Check, X, AlertTriangle, MessageSquare, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StructuredOutputSectionProps {
  structuredOutput: string | null;
  defaultOpen?: boolean;
}

type ParsedOutput = Record<string, unknown>;

const VERDICT_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  approve: { label: 'Approve', icon: Check, className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  request_changes: { label: 'Request Changes', icon: AlertTriangle, className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  comment: { label: 'Comment', icon: MessageSquare, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
};

const FIELD_FORMAT_HINTS: Record<string, ContentFormat> = {
  gitlab_comment: 'markdown',
  slack_message: 'mrkdwn',
  slack_report: 'mrkdwn',
  jira_description: 'json',
};

const PRIORITY_FIELDS = ['verdict', 'success', 'summary', 'slack_message', 'slack_report', 'gitlab_comment'];

function detectFieldFormat(key: string, value: unknown): ContentFormat {
  if (FIELD_FORMAT_HINTS[key]) return FIELD_FORMAT_HINTS[key];
  if (typeof value === 'object') return 'json';
  if (typeof value === 'string') return detectFormat(value);
  return 'plain';
}

function isShortValue(value: unknown): boolean {
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string' && value.length < 80 && !value.includes('\n')) return true;
  return false;
}

function isUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^https?:\/\//.test(value);
}

function sortFields(entries: [string, unknown][]): [string, unknown][] {
  return entries.sort((a, b) => {
    const aIdx = PRIORITY_FIELDS.indexOf(a[0]);
    const bIdx = PRIORITY_FIELDS.indexOf(b[0]);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a[0].localeCompare(b[0]);
  });
}

function FieldValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  if (fieldKey === 'verdict' && typeof value === 'string') {
    const config = VERDICT_CONFIG[value] || { label: value, icon: MessageSquare, className: '' };
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={cn('gap-1.5 font-medium', config.className)}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  }

  if (typeof value === 'boolean') {
    return value ? (
      <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
        <Check className="h-3 w-3" /> Yes
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1 bg-red-500/10 text-red-600 border-red-500/20">
        <X className="h-3 w-3" /> No
      </Badge>
    );
  }

  if (typeof value === 'number') {
    return <span className="font-mono text-sm">{value}</span>;
  }

  if (typeof value === 'string') {
    if (isUrl(value)) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          {value.length > 60 ? value.slice(0, 60) + '...' : value}
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    }
    if (isShortValue(value)) {
      return <span className="text-sm">{value}</span>;
    }
    const format = detectFieldFormat(fieldKey, value);
    return (
      <div className="mt-2 rounded-md border bg-muted/20 p-3">
        <ContentRenderer content={value} format={format} />
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground text-sm">[]</span>;
    if (value.every(v => typeof v === 'string' && v.length < 100)) {
      return (
        <ul className="mt-2 space-y-1">
          {value.map((item, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-muted-foreground">•</span>
              <span>{String(item)}</span>
            </li>
          ))}
        </ul>
      );
    }
    const content = JSON.stringify(value, null, 2);
    return (
      <div className="mt-2 rounded-md border bg-muted/20 p-3">
        <ContentRenderer content={content} format="json" />
      </div>
    );
  }

  if (typeof value === 'object' && value !== null) {
    const content = JSON.stringify(value, null, 2);
    return (
      <div className="mt-2 rounded-md border bg-muted/20 p-3">
        <ContentRenderer content={content} format="json" />
      </div>
    );
  }

  return <span className="text-muted-foreground text-sm">-</span>;
}

function FieldItem({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  const format = detectFieldFormat(fieldKey, value);
  const isShort = isShortValue(value) || isUrl(value);

  return (
    <div className={cn(
      'py-3 border-b border-border/50 last:border-0',
      isShort && 'flex items-center justify-between gap-4'
    )}>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-medium text-foreground">{fieldKey}</span>
        {!isShort && !Array.isArray(value) && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">
            {format}
          </Badge>
        )}
        {Array.isArray(value) && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">
            {value.length} items
          </Badge>
        )}
      </div>
      <FieldValue fieldKey={fieldKey} value={value} />
    </div>
  );
}

export function StructuredOutputSection({ structuredOutput, defaultOpen = false }: StructuredOutputSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const parsed = useMemo<ParsedOutput | null>(() => {
    if (!structuredOutput) return null;
    try {
      return JSON.parse(structuredOutput);
    } catch {
      return null;
    }
  }, [structuredOutput]);

  const sortedEntries = useMemo(() => {
    if (!parsed) return [];
    return sortFields(Object.entries(parsed));
  }, [parsed]);

  if (!parsed || sortedEntries.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-2 py-2 hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors">
          <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
          <h3 className="text-sm font-semibold">Structured Output</h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
            {sortedEntries.length} {sortedEntries.length === 1 ? 'field' : 'fields'}
          </Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-lg border bg-card p-4 mt-2">
          {sortedEntries.map(([key, value]) => (
            <FieldItem key={key} fieldKey={key} value={value} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
