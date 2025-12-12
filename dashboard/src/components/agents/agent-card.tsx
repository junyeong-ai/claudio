'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Bot, Braces, Clock, Copy, History, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Agent } from '@/types/api';

interface AgentCardProps {
  agent: Agent;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const MODEL_COLORS: Record<string, string> = {
  haiku: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  sonnet: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  opus: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export function AgentCard({ agent, onEdit, onDelete, onDuplicate }: AgentCardProps) {
  const visibleKeywords = agent.keywords.slice(0, 5);
  const remainingCount = agent.keywords.length - 5;

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      <div
        className="group cursor-pointer bg-card text-card-foreground rounded-xl border shadow-sm hover:border-primary/50 transition-colors h-full flex flex-col overflow-hidden"
        onClick={onEdit}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Bot className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="font-semibold truncate">{agent.name}</span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <Link href={`/history?agent=${encodeURIComponent(agent.name)}`} aria-label="View agent history">
                  <History className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => handleAction(e, onDuplicate)}
                aria-label="Duplicate agent"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => handleAction(e, onEdit)}
                aria-label="Edit agent"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={(e) => handleAction(e, onDelete)}
                aria-label="Delete agent"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {agent.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2 break-words">{agent.description}</p>
          )}
        </div>

        {/* Content */}
        <div className="px-4 pb-4 space-y-3 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={MODEL_COLORS[agent.model] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}>
              {agent.model}
            </Badge>
            <Badge variant="outline">P{agent.priority}</Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {agent.timeout}s
            </span>
            {agent.static_response && <Badge variant="secondary">static</Badge>}
            {agent.output_schema && (
              <Badge variant="outline" className="gap-1">
                <Braces className="h-3 w-3" />
                JSON
              </Badge>
            )}
          </div>

          {agent.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-[52px] overflow-hidden">
              {visibleKeywords.map((keyword) => (
                <span key={keyword} className="text-xs px-1.5 py-0.5 bg-muted rounded truncate max-w-[120px]">
                  {keyword}
                </span>
              ))}
              {remainingCount > 0 && (
                <span className="text-xs px-1.5 py-0.5 text-muted-foreground">+{remainingCount}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
