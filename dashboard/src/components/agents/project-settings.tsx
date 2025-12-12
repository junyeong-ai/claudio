'use client';

import { useState, useMemo } from 'react';
import { X, ShieldCheck, Plus } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import type { Project, CreateProject, UpdateProject } from '@/types/api';

interface ProjectSettingsProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateProject | UpdateProject) => Promise<void>;
  onDelete?: () => void;
  isLoading?: boolean;
}

function RemovableBadge({
  children,
  onRemove,
  variant = 'secondary',
}: {
  children: React.ReactNode;
  onRemove: () => void;
  variant?: 'secondary' | 'outline' | 'destructive';
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
        className="ml-0.5 rounded-full hover:bg-foreground/20 p-0.5"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

function ProjectSettingsContent({
  project,
  onOpenChange,
  onSave,
  onDelete,
  isLoading,
}: Omit<ProjectSettingsProps, 'open'>) {
  const isCreate = !project;

  const initialState = useMemo(() => ({
    name: project?.name ?? '',
    systemPrompt: project?.system_prompt ?? '',
    allowedTools: project?.allowed_tools ?? [],
    disallowedTools: project?.disallowed_tools ?? [],
    isDefault: project?.is_default ?? false,
    enableUserContext: project?.enable_user_context ?? true,
    fallbackAgent: project?.fallback_agent ?? 'general',
    classifyModel: project?.classify_model ?? 'haiku',
    classifyTimeout: project?.classify_timeout ?? 30,
    rateLimitRpm: project?.rate_limit_rpm ?? 0,
  }), [project]);

  const [name, setName] = useState(initialState.name);
  const [systemPrompt, setSystemPrompt] = useState(initialState.systemPrompt);
  const [allowedTools, setAllowedTools] = useState<string[]>(initialState.allowedTools);
  const [disallowedTools, setDisallowedTools] = useState<string[]>(initialState.disallowedTools);
  const [isDefault, setIsDefault] = useState(initialState.isDefault);
  const [enableUserContext, setEnableUserContext] = useState(initialState.enableUserContext);
  const [fallbackAgent, setFallbackAgent] = useState(initialState.fallbackAgent);
  const [classifyModel, setClassifyModel] = useState(initialState.classifyModel);
  const [classifyTimeout, setClassifyTimeout] = useState(initialState.classifyTimeout);
  const [rateLimitRpm, setRateLimitRpm] = useState(initialState.rateLimitRpm);
  const [toolInput, setToolInput] = useState('');
  const [disallowedInput, setDisallowedInput] = useState('');

  const handleSave = async () => {
    if (isCreate) {
      await onSave({
        name: name.trim(),
        system_prompt: systemPrompt.trim() || undefined,
        allowed_tools: allowedTools.length > 0 ? allowedTools : undefined,
        disallowed_tools: disallowedTools.length > 0 ? disallowedTools : undefined,
        is_default: isDefault || undefined,
        enable_user_context: enableUserContext,
        fallback_agent: fallbackAgent.trim() || 'general',
        classify_model: classifyModel.trim() || 'haiku',
        classify_timeout: classifyTimeout || 30,
        rate_limit_rpm: rateLimitRpm || undefined,
      });
    } else {
      await onSave({
        name: name.trim(),
        system_prompt: systemPrompt.trim() || undefined,
        allowed_tools: allowedTools.length > 0 ? allowedTools : undefined,
        disallowed_tools: disallowedTools.length > 0 ? disallowedTools : undefined,
        is_default: isDefault,
        enable_user_context: enableUserContext,
        fallback_agent: fallbackAgent.trim(),
        classify_model: classifyModel.trim(),
        classify_timeout: classifyTimeout,
        rate_limit_rpm: rateLimitRpm,
      });
    }
    onOpenChange(false);
  };

  const addTool = (list: string[], setList: (v: string[]) => void, input: string, setInput: (v: string) => void) => {
    const trimmed = input.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setInput('');
    }
  };

  const removeTool = (list: string[], setList: (v: string[]) => void, tool: string) => {
    setList(list.filter((t) => t !== tool));
  };

  const canSave = !!name.trim();

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <DialogHeader className="shrink-0">
        <DialogTitle>
          {isCreate ? 'New Project' : `Edit Project: ${project?.name}`}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isCreate ? 'Create a new project' : 'Edit project settings'}
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
        <TabsList className="grid w-full grid-cols-3 shrink-0">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="prompt">System Prompt</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto mt-4 pr-1">
          <TabsContent value="basic" className="space-y-5 m-0">
            {/* Project ID Info (Create only) */}
            {isCreate && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  Project ID will be auto-generated from name (e.g., &quot;My Project&quot; → &quot;my-project&quot;)
                </p>
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="project-name">Display Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Project"
              />
            </div>

            {/* Project Options */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
                <Checkbox
                  id="is-default"
                  checked={isDefault}
                  onCheckedChange={(checked) => setIsDefault(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="is-default" className="text-sm font-medium cursor-pointer">
                    Set as default project
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Used when no project is specified
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
                <Checkbox
                  id="enable-user-context"
                  checked={enableUserContext}
                  onCheckedChange={(checked) => setEnableUserContext(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="enable-user-context" className="text-sm font-medium cursor-pointer">
                    Enable user context
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Include user rules and history
                  </p>
                </div>
              </div>
            </div>

            {/* Classification */}
            <div className="border rounded-lg p-4 space-y-4">
              <Label className="text-sm font-medium">Classification</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fallback-agent" className="text-xs text-muted-foreground">Fallback Agent</Label>
                  <Input
                    id="fallback-agent"
                    value={fallbackAgent}
                    onChange={(e) => setFallbackAgent(e.target.value)}
                    placeholder="general"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classify-model" className="text-xs text-muted-foreground">Model</Label>
                  <Input
                    id="classify-model"
                    value={classifyModel}
                    onChange={(e) => setClassifyModel(e.target.value)}
                    placeholder="haiku"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classify-timeout" className="text-xs text-muted-foreground">Timeout (sec)</Label>
                  <Input
                    id="classify-timeout"
                    type="number"
                    value={classifyTimeout}
                    onChange={(e) => setClassifyTimeout(parseInt(e.target.value) || 30)}
                    placeholder="30"
                  />
                </div>
              </div>
            </div>

            {/* Rate Limiting */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="rate-limit-rpm" className="text-sm font-medium whitespace-nowrap">Rate Limiting</Label>
                <Input
                  id="rate-limit-rpm"
                  type="number"
                  value={rateLimitRpm}
                  onChange={(e) => setRateLimitRpm(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  min={0}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">requests per minute (0 = unlimited)</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="prompt" className="m-0">
            <MarkdownEditor
              label="System Prompt"
              value={systemPrompt}
              onChange={setSystemPrompt}
              placeholder={`Enter the system prompt for this project...

# Example Project Prompt

This prompt will be prepended to all agent requests.

## Guidelines
- Be concise and clear
- Define common behaviors
- Set response language/format`}
              minHeight="350px"
              maxHeight="450px"
              defaultMode={systemPrompt ? 'preview' : 'edit'}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Prepended to all requests. Click to edit.
            </p>
          </TabsContent>

          <TabsContent value="tools" className="space-y-6 m-0">
            {/* Allowed Tools */}
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Label>Allowed Tools</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tools agents can use. Empty = allow all.
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">{allowedTools.length}</Badge>
              </div>
              <div className="flex gap-2">
                <Input
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTool(allowedTools, setAllowedTools, toolInput, setToolInput))}
                  placeholder="Bash, Read, WebFetch..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTool(allowedTools, setAllowedTools, toolInput, setToolInput)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {allowedTools.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-3 bg-muted/50 rounded-lg">
                  {allowedTools.map((tool) => (
                    <RemovableBadge key={tool} onRemove={() => removeTool(allowedTools, setAllowedTools, tool)}>
                      {tool}
                    </RemovableBadge>
                  ))}
                </div>
              )}
            </div>

            {/* Disallowed Tools */}
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Label>Disallowed Tools</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tools that should never be used.
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">{disallowedTools.length}</Badge>
              </div>
              <div className="flex gap-2">
                <Input
                  value={disallowedInput}
                  onChange={(e) => setDisallowedInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTool(disallowedTools, setDisallowedTools, disallowedInput, setDisallowedInput))}
                  placeholder="Write, Edit, NotebookEdit..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTool(disallowedTools, setDisallowedTools, disallowedInput, setDisallowedInput)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {disallowedTools.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-3 bg-destructive/10 rounded-lg">
                  {disallowedTools.map((tool) => (
                    <RemovableBadge key={tool} variant="destructive" onRemove={() => removeTool(disallowedTools, setDisallowedTools, tool)}>
                      {tool}
                    </RemovableBadge>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between border-t pt-4 mt-4 shrink-0">
        {!isCreate && (
          project?.is_default ? (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Default project (cannot delete)
            </div>
          ) : onDelete ? (
            <Button variant="destructive" onClick={onDelete}>
              Delete Project
            </Button>
          ) : null
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isLoading}>
            {isCreate ? 'Create Project' : 'Save Changes'}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

export function ProjectSettings({ open, ...props }: ProjectSettingsProps) {
  return (
    <Dialog open={open} onOpenChange={props.onOpenChange}>
      {open && <ProjectSettingsContent key={props.project?.id ?? 'new'} {...props} />}
    </Dialog>
  );
}
