'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { formatNumber, cn } from '@/lib/utils';
import type { Tag } from '../types';
import { deleteTag } from '../api';

interface TagCloudProps {
  tags: Tag[];
  onDeleted: () => void;
}

const INITIAL_DISPLAY = 20;

const HIDDEN_PREFIXES = ['page_id:'];

const tagColors: Record<string, string> = {
  source: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20',
  space: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/20',
  'jira-project': 'bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20',
  'jira-type': 'bg-orange-500/10 text-orange-700 dark:text-orange-400 hover:bg-orange-500/20',
  'jira-status': 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20',
  project: 'bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20',
  type: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 hover:bg-pink-500/20',
  agent: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/20',
};

function getTagColor(tag: string): string {
  for (const [prefix, color] of Object.entries(tagColors)) {
    if (tag.startsWith(`${prefix}:`)) {
      return color;
    }
  }
  return 'bg-muted hover:bg-muted/80';
}

export function TagCloud({ tags, onDeleted }: TagCloudProps) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredTags = useMemo(() => {
    return tags.filter((tag) => !HIDDEN_PREFIXES.some((prefix) => tag.tag.startsWith(prefix)));
  }, [tags]);

  const displayedTags = showAll ? filteredTags : filteredTags.slice(0, INITIAL_DISPLAY);
  const hasMore = filteredTags.length > INITIAL_DISPLAY;
  const hiddenCount = tags.length - filteredTags.length;

  const handleTagClick = (tag: Tag) => {
    router.push(`/plugins/semantic?tags=${encodeURIComponent(tag.tag)}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await deleteTag(deleteTarget.tag);
      onDeleted();
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="flex flex-wrap gap-2"
      >
        <AnimatePresence mode="popLayout">
          {displayedTags.map((tag) => (
            <motion.div
              key={tag.tag}
              variants={staggerItem}
              layout
              exit={{ opacity: 0, scale: 0.8 }}
              className="group flex items-center"
            >
              <Badge
                variant="secondary"
                className={cn(
                  'cursor-pointer transition-colors rounded-r-none border-r-0',
                  getTagColor(tag.tag)
                )}
                onClick={() => handleTagClick(tag)}
              >
                <span className="font-medium">{tag.tag}</span>
                <span className="ml-1.5 opacity-70">{formatNumber(tag.count)}</span>
              </Badge>
              <button
                onClick={() => setDeleteTarget(tag)}
                className={cn(
                  'h-[22px] px-1.5 rounded-r-md border transition-colors',
                  'bg-muted/50 border-l-0 hover:bg-destructive/10 hover:text-destructive'
                )}
                aria-label={`Delete ${tag.tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <div className="flex items-center gap-4 mt-4">
        {hasMore && (
          <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show less' : `Show all ${filteredTags.length} tags`}
          </Button>
        )}
        {hiddenCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {hiddenCount} internal tags hidden
          </span>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete tag"
        description={
          deleteTarget
            ? `This will delete ${formatNumber(deleteTarget.count)} documents with tag "${deleteTarget.tag}". This action cannot be undone.`
            : ''
        }
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </>
  );
}
