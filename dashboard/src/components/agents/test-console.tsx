'use client';

import { useState } from 'react';
import { Send, Zap, Clock, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useClassifyTest } from '@/hooks/use-agents';
import { cn, formatNumber } from '@/lib/utils';

interface TestConsoleProps {
  projectId: string | null;
}

const methodColors: Record<string, string> = {
  keyword: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  semantic: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  llm: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  fallback: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export function TestConsole({ projectId }: TestConsoleProps) {
  const [text, setText] = useState('');
  const { mutate: classify, data: result, isPending, reset } = useClassifyTest(projectId);

  const handleTest = () => {
    if (!text.trim() || !projectId) return;
    classify(text.trim());
  };

  const handleClear = () => {
    setText('');
    reset();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Test Classification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter text to classify..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            disabled={!projectId}
          />
          <Button onClick={handleTest} disabled={!text.trim() || !projectId || isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {result && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="default">{result.agent}</Badge>
                <Badge className={cn(methodColors[result.method])}>
                  {result.method}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                Clear
              </Button>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" />
                {(result.confidence * 100).toFixed(0)}%
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatNumber(result.duration_ms)}ms
              </div>
            </div>

            {result.matched_keyword && (
              <p className="text-sm">
                <span className="text-muted-foreground">Matched: </span>
                <code className="px-1 py-0.5 bg-background rounded">
                  {result.matched_keyword}
                </code>
              </p>
            )}

            {result.reasoning && (
              <p className="text-sm text-muted-foreground">
                {result.reasoning}
              </p>
            )}
          </div>
        )}

        {!projectId && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Select a project to test classification
          </p>
        )}
      </CardContent>
    </Card>
  );
}
