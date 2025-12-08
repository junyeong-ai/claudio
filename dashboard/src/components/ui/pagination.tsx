'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  className?: string;
  showPageNumbers?: boolean;
  siblingCount?: number;
  showPageJump?: boolean;
  showFirstLast?: boolean;
}

function generatePageNumbers(current: number, total: number, siblingCount: number): (number | 'ellipsis')[] {
  const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);

  if (total <= siblingCount * 2 + 5) {
    return range(1, total);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    return [...range(1, siblingCount * 2 + 3), 'ellipsis', total];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    return [1, 'ellipsis', ...range(total - siblingCount * 2 - 2, total)];
  }

  return [1, 'ellipsis', ...range(leftSibling, rightSibling), 'ellipsis', total];
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  isLoading,
  className,
  showPageNumbers = true,
  siblingCount = 1,
  showPageJump = false,
  showFirstLast = false,
}: PaginationProps) {
  const pages = generatePageNumbers(page, totalPages, siblingCount);
  const [jumpValue, setJumpValue] = useState('');

  const handleJump = () => {
    const pageNum = parseInt(jumpValue, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpValue('');
    }
  };

  const handleJumpKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJump();
    }
  };

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn('flex flex-wrap items-center justify-center gap-1', className)}
    >
      {showFirstLast && (
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 sm:h-9 sm:w-9 hidden sm:flex"
          onClick={() => onPageChange(1)}
          disabled={page <= 1 || isLoading}
          aria-label="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11 sm:h-9 sm:w-9"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || isLoading}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {showPageNumbers && (
        <>
          <span className="px-3 text-sm text-muted-foreground tabular-nums sm:hidden" aria-current="page">
            {page} / {totalPages}
          </span>
          <div className="hidden sm:flex items-center gap-1" role="list">
            {pages.map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground" aria-hidden>
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={page === p ? 'default' : 'outline'}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => onPageChange(p)}
                  disabled={isLoading}
                  aria-label={`Page ${p}`}
                  aria-current={page === p ? 'page' : undefined}
                >
                  {p}
                </Button>
              )
            )}
          </div>
        </>
      )}

      {!showPageNumbers && (
        <span className="px-3 text-sm text-muted-foreground tabular-nums" aria-current="page">
          {page} / {totalPages}
        </span>
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11 sm:h-9 sm:w-9"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || isLoading}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {showFirstLast && (
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 sm:h-9 sm:w-9 hidden sm:flex"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages || isLoading}
          aria-label="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      )}

      {showPageJump && totalPages > 5 && (
        <div className="flex items-center gap-1 ml-2 hidden sm:flex">
          <span className="text-sm text-muted-foreground">Go to</span>
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={handleJumpKeyDown}
            onBlur={handleJump}
            placeholder="#"
            className="w-16 h-9 text-center"
            disabled={isLoading}
            aria-label="Jump to page"
          />
        </div>
      )}
    </nav>
  );
}

interface SimplePaginationProps {
  page: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  className?: string;
}

export function SimplePagination({ page, hasMore, onPageChange, isLoading, className }: SimplePaginationProps) {
  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn('flex items-center justify-center gap-2', className)}
    >
      <Button
        variant="outline"
        className="h-11 min-w-11 sm:h-9 sm:min-w-9 px-3"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || isLoading}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Previous</span>
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums min-w-[60px] text-center">
        Page {page}
      </span>
      <Button
        variant="outline"
        className="h-11 min-w-11 sm:h-9 sm:min-w-9 px-3"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasMore || isLoading}
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </nav>
  );
}
