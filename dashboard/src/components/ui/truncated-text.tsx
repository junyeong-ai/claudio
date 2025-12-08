'use client';

import * as React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TruncatedTextProps {
  text: string;
  className?: string;
  maxWidth?: string;
  lines?: number;
}

export function TruncatedText({ text, className, maxWidth = 'max-w-32', lines }: TruncatedTextProps) {
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  React.useEffect(() => {
    const element = textRef.current;
    if (element) {
      setIsTruncated(element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight);
    }
  }, [text]);

  const truncateClass = lines ? `line-clamp-${lines}` : 'truncate';

  const content = (
    <span ref={textRef} className={cn(truncateClass, maxWidth, className)}>
      {text}
    </span>
  );

  if (!isTruncated) {
    return content;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs break-words">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
