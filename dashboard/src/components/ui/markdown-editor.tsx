'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Eye, Edit3, Maximize2, X, Columns2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { escapeCustomTags } from '@/lib/content';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  label?: string;
  className?: string;
  defaultMode?: 'edit' | 'preview';
}

// Markdown Preview with custom styling (Tailwind v4 doesn't have prose)
function MarkdownPreview({
  content,
  placeholder,
}: {
  content: string;
  placeholder?: string;
}) {
  if (!content) {
    return (
      <div className="text-muted-foreground italic h-full">
        {placeholder}
      </div>
    );
  }

  return (
    <div>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0 pb-2 border-b">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mt-5 mb-3 first:mt-0 pb-1 border-b">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium mt-4 mb-2 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-medium mt-3 mb-2 first:mt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-3 first:mt-0 last:mb-0 leading-relaxed">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-3 ml-6 list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 ml-6 list-decimal space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const codeContent = String(children);
            const isBlock = className || codeContent.includes('\n');

            if (isBlock) {
              return <code className="text-sm font-mono">{children}</code>;
            }
            return (
              <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 p-4 bg-muted rounded-lg overflow-x-auto whitespace-pre-wrap break-words">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary underline hover:no-underline"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => (
            <del className="line-through text-muted-foreground">{children}</del>
          ),
          hr: () => <hr className="my-6 border-border" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full border-collapse border border-border text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-border">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2">{children}</td>
          ),
          input: ({ checked, disabled }) => (
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              className="mr-2 rounded"
              readOnly
            />
          ),
        }}
      >
        {escapeCustomTags(content)}
      </ReactMarkdown>
    </div>
  );
}

// Mode Toggle Button - uses native button, NOT shadcn Button
function ModeButton({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        // Prevent focus loss from textarea
        e.preventDefault();
      }}
      onClick={onClick}
      className={cn(
        'h-7 px-3 text-xs rounded-md transition-colors flex items-center gap-1.5 select-none',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
        className
      )}
    >
      {children}
    </button>
  );
}

// Expanded Editor Dialog using Radix
function ExpandedEditorDialog({
  open,
  onOpenChange,
  value,
  onChange,
  placeholder,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('split');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when dialog opens or mode changes to edit/split
  useEffect(() => {
    if (open && (mode === 'edit' || mode === 'split')) {
      // Delay to ensure DOM is ready after animation
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, mode]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-4 md:inset-8 lg:inset-12 z-[100] bg-background rounded-xl shadow-2xl border flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 shrink-0">
            <DialogPrimitive.Title className="font-medium">
              {label || 'Markdown Editor'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Edit markdown content in expanded view
            </DialogPrimitive.Description>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <ModeButton active={mode === 'edit'} onClick={() => setMode('edit')}>
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </ModeButton>
                <ModeButton active={mode === 'split'} onClick={() => setMode('split')}>
                  <Columns2 className="h-3.5 w-3.5" />
                  Split
                </ModeButton>
                <ModeButton active={mode === 'preview'} onClick={() => setMode('preview')}>
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </ModeButton>
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Content */}
          <div
            className={cn(
              'flex-1 min-h-0',
              mode === 'split' ? 'grid grid-cols-2' : ''
            )}
          >
            {(mode === 'edit' || mode === 'split') && (
              <div
                className={cn(
                  'h-full flex flex-col',
                  mode === 'split' && 'border-r'
                )}
              >
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 w-full p-4 bg-transparent font-mono text-sm resize-none focus:outline-none caret-foreground"
                  spellCheck={false}
                  autoFocus
                />
              </div>
            )}
            {(mode === 'preview' || mode === 'split') && (
              <div
                className="h-full overflow-y-auto p-4 cursor-default"
                onPointerDown={(e) => {
                  // Only switch to edit in preview-only mode
                  if (mode === 'preview') {
                    e.preventDefault();
                    setMode('edit');
                  }
                }}
              >
                <MarkdownPreview
                  content={value}
                  placeholder={placeholder}
                />
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Enter markdown content...',
  minHeight = '200px',
  maxHeight = '400px',
  label,
  className,
  defaultMode = 'preview',
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>(defaultMode);
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when switching to edit mode
  useEffect(() => {
    if (mode === 'edit' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Click preview to switch to edit
  const handlePreviewClick = () => {
    setMode('edit');
  };

  // Blur to preview if content exists
  const handleBlur = () => {
    if (value.trim()) {
      setMode('preview');
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
              <ModeButton
                active={mode === 'edit'}
                onClick={() => setMode('edit')}
                className="h-6 px-2"
              >
                <Edit3 className="h-3 w-3" />
              </ModeButton>
              <ModeButton
                active={mode === 'preview'}
                onClick={() => setMode('preview')}
                className="h-6 px-2"
              >
                <Eye className="h-3 w-3" />
              </ModeButton>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="h-6 w-6 ml-1 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div
        className="border rounded-lg overflow-hidden"
        style={{ minHeight, maxHeight }}
      >
        {mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="w-full h-full p-3 bg-transparent font-mono text-sm resize-none focus:outline-none"
            style={{ minHeight, maxHeight }}
            spellCheck={false}
          />
        ) : (
          <div
            className="h-full overflow-y-auto p-3 text-sm cursor-text"
            style={{ minHeight, maxHeight }}
            onClick={handlePreviewClick}
          >
            <MarkdownPreview
              content={value}
              placeholder={placeholder}
            />
          </div>
        )}
      </div>

      {/* Expanded Editor Dialog */}
      <ExpandedEditorDialog
        open={isExpanded}
        onOpenChange={setIsExpanded}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        label={label}
      />
    </div>
  );
}
