'use client';

import { useState, useMemo, useCallback } from 'react';
import { X, Plus, Info, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { SchemaEditor } from '@/components/agents/schema-editor';
import type { Agent, CreateAgent, UpdateAgent, JsonSchema } from '@/types/api';

interface AgentEditorProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateAgent | UpdateAgent) => Promise<void>;
  onDelete?: () => void;
  isLoading?: boolean;
}

const MODELS = [
  { value: 'haiku', label: 'Haiku', description: 'Fast, lightweight' },
  { value: 'sonnet', label: 'Sonnet', description: 'Balanced performance' },
  { value: 'opus', label: 'Opus', description: 'Most capable' },
];

const COMMON_TOOLS = ['Read', 'Bash', 'WebFetch', 'Grep', 'Glob', 'Edit', 'Write', 'Task'];

function RemovableBadge({
  children,
  onRemove,
  variant = 'secondary',
  label,
}: {
  children: React.ReactNode;
  onRemove: () => void;
  variant?: 'secondary' | 'outline' | 'destructive';
  label?: string;
}) {
  return (
    <Badge variant={variant} className="gap-1 pr-1">
      {children}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 rounded-full hover:bg-foreground/20 p-1.5 min-w-[24px] min-h-[24px] flex items-center justify-center touch-manipulation"
        aria-label={label || 'Remove'}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

function AgentEditorContent({
  agent,
  onOpenChange,
  onSave,
  onDelete,
  isLoading,
}: Omit<AgentEditorProps, 'open'>) {
  const isCreate = !agent;

  const initialState = useMemo(() => ({
    name: agent?.name ?? '',
    description: agent?.description ?? '',
    model: agent?.model ?? 'haiku',
    priority: agent?.priority ?? 50,
    timeout: agent?.timeout ?? 300,
    staticResponse: agent?.static_response ?? false,
    workingDir: agent?.working_dir ?? '',
    instruction: agent?.instruction ?? '',
    keywords: agent?.keywords ?? [],
    examples: agent?.examples ?? [],
    tools: agent?.tools ?? [],
    outputSchema: agent?.output_schema ?? null,
  }), [agent]);

  const [name, setName] = useState(initialState.name);
  const [description, setDescription] = useState(initialState.description);
  const [model, setModel] = useState(initialState.model);
  const [priority, setPriority] = useState(initialState.priority);
  const [timeout, setTimeout] = useState(initialState.timeout);
  const [staticResponse, setStaticResponse] = useState(initialState.staticResponse);
  const [workingDir, setWorkingDir] = useState(initialState.workingDir);
  const [instruction, setInstruction] = useState(initialState.instruction);
  const [keywords, setKeywords] = useState<string[]>(initialState.keywords);
  const [examples, setExamples] = useState<string[]>(initialState.examples);
  const [tools, setTools] = useState<string[]>(initialState.tools);
  const [outputSchema, setOutputSchema] = useState<JsonSchema | null>(initialState.outputSchema);

  const [keywordInput, setKeywordInput] = useState('');
  const [exampleInput, setExampleInput] = useState('');
  const [toolInput, setToolInput] = useState('');

  // Validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Agent name is required';
    if (!description.trim()) errors.description = 'Description is required';
    return errors;
  }, [name, description]);

  const hasErrors = Object.keys(validationErrors).length > 0;

  const handleSave = async () => {
    const data = {
      name: name.trim(),
      description: description.trim(),
      model,
      priority,
      timeout,
      static_response: staticResponse,
      working_dir: workingDir.trim() || undefined,
      instruction: instruction.trim() || undefined,
      keywords,
      examples,
      tools: tools.length > 0 ? tools : undefined,
      output_schema: outputSchema || undefined,
    };
    await onSave(data);
    onOpenChange(false);
  };

  const addItem = (
    list: string[],
    setList: (v: string[]) => void,
    input: string,
    setInput: (v: string) => void
  ) => {
    const trimmed = input.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setInput('');
    }
  };

  const removeItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.filter((i) => i !== item));
  };

  const canSave = !hasErrors;

  return (
    <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-hidden flex flex-col">
      <DialogHeader className="shrink-0">
        <DialogTitle>
          {isCreate ? 'New Agent' : `Edit Agent: ${agent?.name}`}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isCreate ? 'Create a new agent' : 'Edit agent configuration'}
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
        <TabsList className="grid w-full grid-cols-5 shrink-0">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="routing">Routing</TabsTrigger>
          <TabsTrigger value="instruction">Instruction</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto mt-4 pr-1">
          <TabsContent value="basic" className="space-y-5 m-0">
            {/* Name & Model Row - 1:1 ratio */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-name" required>Agent Name</Label>
                <Input
                  id="agent-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => markTouched('name')}
                  placeholder="code-reviewer"
                  aria-invalid={touched.name && !!validationErrors.name}
                  className={touched.name && validationErrors.name ? 'border-destructive' : ''}
                />
                {touched.name && validationErrors.name ? (
                  <p className="text-xs text-destructive flex items-center gap-1" role="alert">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.name}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Unique identifier for routing
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="agent-model" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">{m.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{m.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="agent-description" required>Description</Label>
              <Textarea
                id="agent-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => markTouched('description')}
                placeholder="Reviews code for quality, best practices, and potential issues..."
                rows={2}
                aria-invalid={touched.description && !!validationErrors.description}
                className={touched.description && validationErrors.description ? 'border-destructive' : ''}
              />
              {touched.description && validationErrors.description ? (
                <p className="text-xs text-destructive flex items-center gap-1" role="alert">
                  <AlertCircle className="h-3 w-3" />
                  {validationErrors.description}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Used for LLM classification. Be specific about capabilities.
                </p>
              )}
            </div>

            {/* Working Directory - full width */}
            <div className="space-y-2">
              <Label htmlFor="working-dir">Working Directory</Label>
              <Input
                id="working-dir"
                value={workingDir}
                onChange={(e) => setWorkingDir(e.target.value)}
                placeholder="/path/to/project (empty = isolated)"
              />
              <p className="text-xs text-muted-foreground">
                Codebase path. Empty = safe isolated env.
              </p>
            </div>

            {/* Priority, Timeout, Static Response - 3 columns */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-priority">Priority</Label>
                <Input
                  id="agent-priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  min={0}
                  max={100}
                />
                <p className="text-xs text-muted-foreground">
                  0-100, higher first
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-timeout">Timeout</Label>
                <Input
                  id="agent-timeout"
                  type="number"
                  value={timeout}
                  onChange={(e) => setTimeout(Number(e.target.value))}
                  min={30}
                  max={600}
                />
                <p className="text-xs text-muted-foreground">
                  Seconds (30-600)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Response</Label>
                <div className="flex items-center space-x-2 h-9 px-3 border rounded-md bg-muted/30">
                  <Checkbox
                    id="static-response"
                    checked={staticResponse}
                    onCheckedChange={(checked) => setStaticResponse(checked === true)}
                  />
                  <Label htmlFor="static-response" className="text-sm font-normal cursor-pointer">
                    Static
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Return as-is
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="routing" className="space-y-6 m-0">
            {/* Keywords */}
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Label>Keywords</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Exact match triggers. Fastest routing method.
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">{keywords.length}</Badge>
              </div>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    (e.preventDefault(),
                    addItem(keywords, setKeywords, keywordInput, setKeywordInput))
                  }
                  placeholder="review, /review, code review..."
                  className="flex-1"
                  aria-label="Add keyword"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addItem(keywords, setKeywords, keywordInput, setKeywordInput)}
                  aria-label="Add keyword"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Press Enter to add</p>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-3 bg-muted/50 rounded-lg max-h-28 overflow-y-auto">
                  {keywords.map((kw) => (
                    <RemovableBadge key={kw} onRemove={() => removeItem(keywords, setKeywords, kw)}>
                      {kw}
                    </RemovableBadge>
                  ))}
                </div>
              )}
            </div>

            {/* Examples */}
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Label>Example Queries</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Used for semantic matching. Add diverse examples.
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">{examples.length}</Badge>
              </div>
              <div className="flex gap-2">
                <Input
                  value={exampleInput}
                  onChange={(e) => setExampleInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    (e.preventDefault(),
                    addItem(examples, setExamples, exampleInput, setExampleInput))
                  }
                  placeholder="Please review my pull request..."
                  className="flex-1"
                  aria-label="Add example"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addItem(examples, setExamples, exampleInput, setExampleInput)}
                  aria-label="Add example"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Press Enter to add</p>
              {examples.length > 0 && (
                <div className="space-y-1 p-3 bg-muted/50 rounded-lg max-h-40 overflow-y-auto">
                  {examples.map((ex, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 text-sm py-1.5 px-2 hover:bg-muted rounded group"
                    >
                      <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors">{ex}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeItem(examples, setExamples, ex);
                        }}
                        className="rounded-full hover:bg-destructive/20 p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity touch-manipulation"
                        aria-label={`Remove example: ${ex.slice(0, 30)}`}
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Routing Info */}
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <strong>Routing Priority:</strong> Keywords (fastest) → Semantic Search → LLM Classification (slowest)
              </div>
            </div>
          </TabsContent>

          <TabsContent value="instruction" className="m-0">
            <MarkdownEditor
              label="Instruction"
              value={instruction}
              onChange={setInstruction}
              placeholder={`Enter the instruction for this agent...

# Example: Code Reviewer

You are an expert code reviewer. When reviewing:

1. **Check for bugs** - Runtime errors, edge cases
2. **Suggest improvements** - Performance, readability
3. **Security** - Validate inputs, prevent injection

Be constructive and specific.`}
              minHeight="350px"
              maxHeight="450px"
              defaultMode={instruction ? 'preview' : 'edit'}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {staticResponse
                ? "⚡ Static Response: This content will be returned directly."
                : "This instruction defines agent behavior. Click to edit."
              }
            </p>
          </TabsContent>

          <TabsContent value="output" className="m-0">
            <SchemaEditor schema={outputSchema} onChange={setOutputSchema} />
            <p className="text-xs text-muted-foreground mt-3">
              {outputSchema
                ? "Agent will return structured JSON matching this schema."
                : "Agent will return natural language responses."
              }
            </p>
          </TabsContent>

          <TabsContent value="tools" className="space-y-5 m-0">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Label>Allowed Tools</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tools this agent can use. Empty = inherit from project.
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">{tools.length}</Badge>
              </div>
              <div className="flex gap-2">
                <Input
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    (e.preventDefault(),
                    addItem(tools, setTools, toolInput, setToolInput))
                  }
                  placeholder="Bash(command:*), mcp__*, ..."
                  className="flex-1"
                  aria-label="Add tool"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addItem(tools, setTools, toolInput, setToolInput)}
                  aria-label="Add tool"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Press Enter to add</p>

              {tools.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 p-3 bg-muted/50 rounded-lg">
                  {tools.map((tool) => (
                    <RemovableBadge
                      key={tool}
                      variant="outline"
                      onRemove={() => removeItem(tools, setTools, tool)}
                    >
                      <code className="text-xs">{tool}</code>
                    </RemovableBadge>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground text-center">
                  No tools specified. Inherits from project settings.
                </div>
              )}
            </div>

            {/* Quick Add Tools */}
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="text-sm">Quick Add</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_TOOLS.map((tool) => (
                  <Button
                    key={tool}
                    type="button"
                    variant={tools.includes(tool) ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-9 text-xs sm:h-8"
                    onClick={() => {
                      if (tools.includes(tool)) {
                        removeItem(tools, setTools, tool);
                      } else {
                        setTools([...tools, tool]);
                      }
                    }}
                  >
                    {tools.includes(tool) ? '✓ ' : '+ '}{tool}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between border-t pt-4 mt-4 shrink-0 gap-3">
        {!isCreate && onDelete && (
          <Button variant="destructive" onClick={onDelete} disabled={isLoading}>
            Delete Agent
          </Button>
        )}
        <div className="flex items-center gap-3">
          {hasErrors && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span>Fill required fields to save</span>
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave} loading={isLoading}>
              {isCreate ? 'Create Agent' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

export function AgentEditor({ open, ...props }: AgentEditorProps) {
  return (
    <Dialog open={open} onOpenChange={props.onOpenChange}>
      {open && <AgentEditorContent key={props.agent?.id ?? 'new'} {...props} />}
    </Dialog>
  );
}
