import React, { Fragment } from 'react';
import { getStandardEmoji } from './emoji';

type TokenType =
  | 'CODE_BLOCK'
  | 'INLINE_CODE'
  | 'LINK'
  | 'USER_MENTION'
  | 'CHANNEL_MENTION'
  | 'SPECIAL_MENTION'
  | 'NEWLINE'
  | 'TEXT';

interface Token {
  type: TokenType;
  value: string;
  raw: string;
  meta?: Record<string, string>;
}

export interface MrkdwnOptions {
  getEmoji?: (name: string) => string | null;
  onUserClick?: (userId: string) => void;
  resolveUser?: (userId: string) => string | null;
  onChannelClick?: (channelId: string) => void;
}

const PATTERNS: Array<{
  type: TokenType;
  regex: RegExp;
  extract: (m: RegExpMatchArray) => Omit<Token, 'type'>;
}> = [
  {
    type: 'CODE_BLOCK',
    regex: /^```([\s\S]*?)```/,
    extract: (m) => ({ value: m[1], raw: m[0] }),
  },
  {
    type: 'INLINE_CODE',
    regex: /^`([^`\n]+)`/,
    extract: (m) => ({ value: m[1], raw: m[0] }),
  },
  {
    type: 'USER_MENTION',
    regex: /^<@([A-Z0-9]+)(?:\|([^>]+))?>/,
    extract: (m) => ({ value: m[2] || m[1], raw: m[0], meta: { userId: m[1] } }),
  },
  {
    type: 'CHANNEL_MENTION',
    regex: /^<#([A-Z0-9]+)(?:\|([^>]+))?>/,
    extract: (m) => ({ value: m[2] || m[1], raw: m[0], meta: { channelId: m[1] } }),
  },
  {
    type: 'SPECIAL_MENTION',
    regex: /^<!([a-z]+)(?:\^([A-Z0-9]+))?(?:\|([^>]+))?>/,
    extract: (m) => ({ value: m[3] || m[1], raw: m[0], meta: { type: m[1] } }),
  },
  {
    type: 'LINK',
    regex: /^<((?:https?|mailto):[^|>]+)\|([^>]+)>/,
    extract: (m) => ({ value: m[2], raw: m[0], meta: { url: m[1] } }),
  },
  {
    type: 'LINK',
    regex: /^<((?:https?|mailto):[^>]+)>/,
    extract: (m) => ({ value: m[1], raw: m[0], meta: { url: m[1] } }),
  },
  {
    type: 'NEWLINE',
    regex: /^\n/,
    extract: (m) => ({ value: '\n', raw: m[0] }),
  },
];

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let matched = false;

    for (const pattern of PATTERNS) {
      const match = remaining.match(pattern.regex);
      if (match) {
        tokens.push({ type: pattern.type, ...pattern.extract(match) });
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      const nextSpecial = remaining.search(/[`<\n]/);
      const textEnd = nextSpecial === -1 ? remaining.length : Math.max(1, nextSpecial);
      const textContent = remaining.slice(0, textEnd);

      if (tokens.length > 0 && tokens[tokens.length - 1].type === 'TEXT') {
        tokens[tokens.length - 1].value += textContent;
        tokens[tokens.length - 1].raw += textContent;
      } else {
        tokens.push({ type: 'TEXT', value: textContent, raw: textContent });
      }

      remaining = remaining.slice(textEnd);
    }
  }

  return tokens;
}

function parseInlineFormatting(text: string, keyPrefix: string, options?: MrkdwnOptions): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;
  const getEmoji = options?.getEmoji ?? getStandardEmoji;

  const inlinePatterns: Array<{
    regex: RegExp;
    render: (m: RegExpMatchArray, key: string) => React.ReactNode;
  }> = [
    {
      regex: /^\*([^\s*][^*]*[^\s*]|[^\s*])\*/,
      render: (m, key) => <strong key={key}>{m[1]}</strong>,
    },
    {
      regex: /^_([^\s_][^_]*[^\s_]|[^\s_])_/,
      render: (m, key) => <em key={key}>{m[1]}</em>,
    },
    {
      regex: /^~([^\s~][^~]*[^\s~]|[^\s~])~/,
      render: (m, key) => <del key={key}>{m[1]}</del>,
    },
    {
      regex: /^:([a-z0-9_+-]+):/,
      render: (m, key) => {
        const name = m[1];
        const emoji = getEmoji(name);
        if (emoji) {
          if (emoji.startsWith('http://') || emoji.startsWith('https://')) {
            // eslint-disable-next-line @next/next/no-img-element
            return <img key={key} src={emoji} alt={`:${name}:`} title={`:${name}:`} className="inline-block h-5 w-5 align-text-bottom" />;
          }
          return <span key={key} title={`:${name}:`}>{emoji}</span>;
        }
        return <span key={key}>:{name}:</span>;
      },
    },
  ];

  while (remaining.length > 0) {
    let matched = false;

    for (const pattern of inlinePatterns) {
      const match = remaining.match(pattern.regex);
      if (match) {
        result.push(pattern.render(match, `${keyPrefix}-${keyIndex++}`));
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      const nextSpecial = remaining.search(/[*_~:]/);
      const textEnd = nextSpecial === -1 ? remaining.length : Math.max(1, nextSpecial);
      const textContent = remaining.slice(0, textEnd);
      const last = result[result.length - 1];

      if (typeof last === 'string') {
        result[result.length - 1] = last + textContent;
      } else {
        result.push(textContent);
      }

      remaining = remaining.slice(textEnd);
    }
  }

  return result;
}

function renderTokens(tokens: Token[], options?: MrkdwnOptions): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let keyIndex = 0;

  for (const token of tokens) {
    switch (token.type) {
      case 'CODE_BLOCK':
        result.push(
          <pre key={`cb-${keyIndex++}`} className="bg-muted px-3 py-2 rounded-md text-xs my-2 overflow-x-auto font-mono">
            <code className="whitespace-pre-wrap break-words">{token.value.trim()}</code>
          </pre>
        );
        break;

      case 'INLINE_CODE':
        result.push(
          <code key={`ic-${keyIndex++}`} className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
            {token.value}
          </code>
        );
        break;

      case 'USER_MENTION': {
        const userId = token.meta?.userId || '';
        const displayName = options?.resolveUser?.(userId) || token.value;
        const isClickable = !!options?.onUserClick;
        result.push(
          isClickable ? (
            <button
              key={`um-${keyIndex++}`}
              onClick={() => options?.onUserClick?.(userId)}
              className="bg-primary/10 text-primary px-1 rounded font-medium hover:bg-primary/20 transition-colors"
              data-user-id={userId}
            >
              @{displayName}
            </button>
          ) : (
            <span key={`um-${keyIndex++}`} className="bg-primary/10 text-primary px-1 rounded font-medium" data-user-id={userId}>
              @{displayName}
            </span>
          )
        );
        break;
      }

      case 'CHANNEL_MENTION': {
        const channelId = token.meta?.channelId || '';
        const isClickable = !!options?.onChannelClick;
        result.push(
          isClickable ? (
            <button
              key={`cm-${keyIndex++}`}
              onClick={() => options?.onChannelClick?.(channelId)}
              className="bg-primary/10 text-primary px-1 rounded font-medium hover:bg-primary/20 transition-colors"
              data-channel-id={channelId}
            >
              #{token.value}
            </button>
          ) : (
            <span key={`cm-${keyIndex++}`} className="bg-primary/10 text-primary px-1 rounded font-medium" data-channel-id={channelId}>
              #{token.value}
            </span>
          )
        );
        break;
      }

      case 'SPECIAL_MENTION':
        result.push(
          <span key={`sm-${keyIndex++}`} className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-1 rounded font-medium">
            @{token.value}
          </span>
        );
        break;

      case 'LINK':
        result.push(
          <a key={`lk-${keyIndex++}`} href={token.meta?.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-words">
            {token.value}
          </a>
        );
        break;

      case 'NEWLINE':
        result.push(<br key={`nl-${keyIndex++}`} />);
        break;

      case 'TEXT':
        result.push(
          <Fragment key={`tx-${keyIndex++}`}>
            {parseInlineFormatting(token.value, `if-${keyIndex}`, options)}
          </Fragment>
        );
        break;
    }
  }

  return result;
}

export function parseMrkdwn(text: string, options?: MrkdwnOptions): React.ReactNode {
  if (!text) return null;

  const decoded = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  return <>{renderTokens(tokenize(decoded), options)}</>;
}
