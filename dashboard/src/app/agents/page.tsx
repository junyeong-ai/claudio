'use client';

import { useState, useCallback, useMemo, Suspense } from 'react';
import { motion } from 'motion/react';
import { Plus, Bot, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton, SkeletonAgentCard } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import {
  ProjectSelector,
  AgentCard,
  AgentEditor,
  TestConsole,
  ProjectSettings,
} from '@/components/agents';
import {
  useProjects,
  useAgents,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useCreateAgent,
  useUpdateAgent,
  useDeleteAgent,
} from '@/hooks/use-agents';
import { useQueryState } from '@/hooks/use-query-state';
import { staggerContainer, staggerItem, transitions } from '@/lib/animations';
import { formatNumber } from '@/lib/utils';
import type { Agent, CreateProject, UpdateProject, CreateAgent, UpdateAgent } from '@/types/api';

function AgentsPageContent() {
  const [queryState, setQueryState] = useQueryState({
    project: '' as string | undefined,
    agent: '' as string | undefined,
  });

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false);
  const [deleteAgentConfirm, setDeleteAgentConfirm] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);

  const { data: projects, isLoading: projectsLoading, refetch: refetchProjects } = useProjects();

  const currentProjectId = useMemo(() => {
    if (queryState.project) return queryState.project;
    if (!projects?.length) return null;
    const defaultProject = projects.find(p => p.is_default);
    return defaultProject?.id ?? projects[0].id;
  }, [queryState.project, projects]);

  const { data: agents, isLoading: agentsLoading, refetch: refetchAgents } = useAgents(currentProjectId);

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createAgent = useCreateAgent(currentProjectId);
  const updateAgent = useUpdateAgent(currentProjectId);
  const deleteAgent = useDeleteAgent(currentProjectId);

  const selectedProject = projects?.find((p) => p.id === currentProjectId) ?? null;

  const agentDialogOpen = queryState.agent === 'new' || (!!queryState.agent && !!agents?.some(a => a.id === queryState.agent));
  const selectedAgent = useMemo(() => {
    if (!queryState.agent || queryState.agent === 'new' || !agents) return null;
    return agents.find(a => a.id === queryState.agent) ?? null;
  }, [queryState.agent, agents]);

  const handleProjectChange = useCallback((projectId: string) => {
    setQueryState({ project: projectId, agent: undefined });
  }, [setQueryState]);

  const handleCreateProject = useCallback(() => {
    setEditingProject(false);
    setProjectDialogOpen(true);
  }, []);

  const handleEditProject = useCallback(() => {
    setEditingProject(true);
    setProjectDialogOpen(true);
  }, []);

  const handleSaveProject = useCallback(
    async (data: CreateProject | UpdateProject) => {
      try {
        if (editingProject && currentProjectId) {
          await updateProject.mutateAsync({ id: currentProjectId, data: data as UpdateProject });
          toast.success('Project updated');
        } else {
          const created = await createProject.mutateAsync(data as CreateProject);
          setQueryState({ project: created.id, agent: undefined });
          toast.success('Project created');
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save project');
        throw error;
      }
    },
    [editingProject, currentProjectId, updateProject, createProject, setQueryState]
  );

  const handleDeleteProjectRequest = useCallback(() => {
    if (!currentProjectId) return;
    setDeleteProjectConfirm(true);
  }, [currentProjectId]);

  const handleDeleteProjectConfirm = useCallback(async () => {
    if (!currentProjectId) return;
    try {
      await deleteProject.mutateAsync(currentProjectId);
      setQueryState({ project: undefined, agent: undefined });
      setProjectDialogOpen(false);
      toast.success('Project deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete project');
    }
  }, [currentProjectId, deleteProject, setQueryState]);

  const handleCreateAgent = useCallback(() => {
    setQueryState({ agent: 'new' });
  }, [setQueryState]);

  const handleEditAgent = useCallback((agent: Agent) => {
    setQueryState({ agent: agent.id });
  }, [setQueryState]);

  const handleCloseAgentDialog = useCallback(() => {
    setQueryState({ agent: undefined });
  }, [setQueryState]);

  const handleDuplicateAgent = useCallback(
    async (agent: Agent) => {
      try {
        await createAgent.mutateAsync({
          name: `${agent.name}-copy`,
          description: agent.description,
          model: agent.model,
          priority: agent.priority,
          keywords: agent.keywords,
          examples: agent.examples,
          instruction: agent.instruction,
          tools: agent.tools,
          timeout: agent.timeout,
          static_response: agent.static_response,
        });
        toast.success('Agent duplicated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to duplicate agent');
      }
    },
    [createAgent]
  );

  const handleSaveAgent = useCallback(
    async (data: CreateAgent | UpdateAgent) => {
      try {
        if (selectedAgent) {
          await updateAgent.mutateAsync({ id: selectedAgent.id, data: data as UpdateAgent });
          toast.success('Agent updated');
        } else {
          await createAgent.mutateAsync(data as CreateAgent);
          toast.success('Agent created');
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save agent');
        throw error;
      }
    },
    [selectedAgent, updateAgent, createAgent]
  );

  const handleDeleteAgentRequest = useCallback((agent?: Agent) => {
    const targetAgent = agent || selectedAgent;
    if (!targetAgent) return;
    setAgentToDelete(targetAgent);
    setDeleteAgentConfirm(true);
  }, [selectedAgent]);

  const handleDeleteAgentConfirm = useCallback(async () => {
    if (!agentToDelete) return;
    try {
      await deleteAgent.mutateAsync(agentToDelete.id);
      setQueryState({ agent: undefined });
      setAgentToDelete(null);
      toast.success('Agent deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete agent');
    }
  }, [agentToDelete, deleteAgent, setQueryState]);

  const handleRefresh = useCallback(() => {
    refetchProjects();
    if (currentProjectId) refetchAgents();
  }, [refetchProjects, refetchAgents, currentProjectId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        description="Manage project agents and classification rules"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleRefresh} aria-label="Refresh agents">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <ProjectSelector
              projects={projects}
              isLoading={projectsLoading}
              value={currentProjectId}
              onChange={handleProjectChange}
              onCreateProject={handleCreateProject}
              onEditProject={handleEditProject}
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {projectsLoading ? (
                <Skeleton className="h-6 w-32" />
              ) : currentProjectId ? (
                <>Agents ({formatNumber(agents?.length ?? 0)})</>
              ) : (
                'Select a project'
              )}
            </h2>
            {currentProjectId && !projectsLoading && (
              <Button onClick={handleCreateAgent}>
                <Plus className="h-4 w-4 mr-1" />
                New Agent
              </Button>
            )}
          </div>

          {projectsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonAgentCard key={i} />
              ))}
            </div>
          ) : !currentProjectId ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={transitions.spring} className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-lg bg-muted/20">
              <Bot className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No project selected</p>
              <p className="text-sm">Select or create a project to manage agents</p>
            </motion.div>
          ) : agentsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonAgentCard key={i} />
              ))}
            </div>
          ) : agents && agents.length > 0 ? (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <motion.div key={agent.id} variants={staggerItem}>
                  <AgentCard
                    agent={agent}
                    onEdit={() => handleEditAgent(agent)}
                    onDelete={() => handleDeleteAgentRequest(agent)}
                    onDuplicate={() => handleDuplicateAgent(agent)}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={transitions.spring} className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-lg bg-muted/20">
              <Bot className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No agents yet</p>
              <p className="text-sm mb-4">Create your first agent to get started</p>
              <Button onClick={handleCreateAgent}>
                <Plus className="h-4 w-4 mr-1" />
                New Agent
              </Button>
            </motion.div>
          )}
        </div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ ...transitions.spring, delay: 0.1 }} className="lg:col-span-1">
          <div className="lg:sticky lg:top-6">
            <TestConsole projectId={currentProjectId} />
          </div>
        </motion.div>
      </div>

      <ProjectSettings
        project={editingProject ? selectedProject : null}
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onSave={handleSaveProject}
        onDelete={editingProject && !selectedProject?.is_default ? handleDeleteProjectRequest : undefined}
        isLoading={createProject.isPending || updateProject.isPending}
      />

      <AgentEditor
        agent={selectedAgent}
        open={agentDialogOpen}
        onOpenChange={(open) => { if (!open) handleCloseAgentDialog(); }}
        onSave={handleSaveAgent}
        onDelete={selectedAgent ? () => handleDeleteAgentRequest() : undefined}
        isLoading={createAgent.isPending || updateAgent.isPending}
      />

      <ConfirmDialog
        open={deleteProjectConfirm}
        onOpenChange={setDeleteProjectConfirm}
        title="Delete Project"
        description="Are you sure you want to delete this project and all its agents? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteProjectConfirm}
        isLoading={deleteProject.isPending}
      />

      <ConfirmDialog
        open={deleteAgentConfirm}
        onOpenChange={(open) => {
          setDeleteAgentConfirm(open);
          if (!open) setAgentToDelete(null);
        }}
        title="Delete Agent"
        description={`Are you sure you want to delete "${agentToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteAgentConfirm}
        isLoading={deleteAgent.isPending}
      />
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-10" />
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-4">
            <div className="h-8" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonAgentCard key={i} />)}
            </div>
          </div>
        </div>
      </div>
    }>
      <AgentsPageContent />
    </Suspense>
  );
}
