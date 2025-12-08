'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { parseMrkdwn, type MrkdwnOptions } from './mrkdwn';

export type ContentFormat = 'json' | 'markdown' | 'mrkdwn' | 'plain';

const MARKDOWN_PATTERNS = [
  /#{1,6}\s+\S/,
  /\*\*[^*]+\*\*/,
  /```[\s\S]*?```/,
  /\[.+?\]\(.+?\)/,
];

const SLACK_PATTERNS = [
  /<https?:\/\/[^|>]+\|[^>]+>/,
  /<@[A-Z0-9]+>/,
  /<#[A-Z0-9]+>/,
  /<![a-z]+>/,
];

const MRKDWN_PATTERNS = [
  /\*[^*\n]+\*(?!\*)/,
  /_[^_\n]+_/,
  /~[^~\n]+~/,
];

/**
 * Detect if content is pure JSON (not inside markdown code blocks)
 * Returns true only if the entire trimmed content is a valid JSON object or array
 */
function isPureJson(content: string): boolean {
  const trimmed = content.trim();
  // Must start with { or [ and end with } or ]
  if (!/^[\[{]/.test(trimmed) || !/[\]}]$/.test(trimmed)) return false;
  // Should not contain markdown code block markers outside JSON
  if (/^```/m.test(content)) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

const HTML_TAGS = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base',
  'bdi', 'bdo', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption',
  'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd', 'del', 'details',
  'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption',
  'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head',
  'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd',
  'label', 'legend', 'li', 'link', 'main', 'map', 'mark', 'menu', 'meta',
  'meter', 'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output',
  'p', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp',
  'script', 'search', 'section', 'select', 'slot', 'small', 'source', 'span',
  'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template',
  'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'u', 'ul',
  'var', 'video', 'wbr',
]);

export function detectFormat(content: string): ContentFormat {
  // Check JSON first (pure JSON without markdown code blocks)
  if (isPureJson(content)) return 'json';
  if (MARKDOWN_PATTERNS.some(p => p.test(content))) return 'markdown';
  if (SLACK_PATTERNS.some(p => p.test(content))) return 'mrkdwn';
  if (MRKDWN_PATTERNS.some(p => p.test(content))) return 'mrkdwn';
  return 'plain';
}

export function escapeCustomTags(content: string): string {
  const codeBlocks: string[] = [];
  let processed = content.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    codeBlocks.push(match);
    return `__CB_${codeBlocks.length - 1}__`;
  });

  processed = processed.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*>/g, (match, tag) => {
    return HTML_TAGS.has(tag.toLowerCase()) ? match : match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });

  codeBlocks.forEach((block, i) => {
    processed = processed.replace(`__CB_${i}__`, block);
  });

  return processed;
}

interface ContentRendererProps {
  content: string;
  format?: ContentFormat;
  mrkdwnOptions?: MrkdwnOptions;
  className?: string;
}

function JsonRenderer({ content, className }: { content: string; className?: string }) {
  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(content.trim()), null, 2);
  } catch {
    formatted = content;
  }
  return (
    <pre className={className ?? 'text-sm font-mono bg-muted/50 rounded p-3 overflow-x-auto'}>
      <code>{formatted}</code>
    </pre>
  );
}

export function ContentRenderer({ content, format, mrkdwnOptions, className }: ContentRendererProps) {
  const detected = format ?? detectFormat(content);

  if (detected === 'json') {
    return <JsonRenderer content={content} className={className} />;
  }

  if (detected === 'markdown') {
    return (
      <div className={className ?? 'prose-compact'}>
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{escapeCustomTags(content)}</ReactMarkdown>
      </div>
    );
  }

  if (detected === 'mrkdwn') {
    return (
      <div className={className ?? 'text-sm leading-relaxed'}>
        {parseMrkdwn(content, mrkdwnOptions)}
      </div>
    );
  }

  return (
    <pre className={className ?? 'text-sm whitespace-pre-wrap font-sans'}>
      {content}
    </pre>
  );
}
