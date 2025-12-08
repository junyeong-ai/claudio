'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Project,
  Agent,
  CreateProject,
  UpdateProject,
  CreateAgent,
  UpdateAgent,
  ClassifyTestResponse,
} from '@/types/api';

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/v1/projects'),
    staleTime: 30 * 1000,
  });
}

export function useProject(id: string | null) {
  return useQuery<Project | null>({
    queryKey: ['projects', id],
    queryFn: () => api.get(`/v1/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProject) => api.post<Project>('/v1/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProject }) =>
      api.put<Project | null>(`/v1/projects/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useAgents(projectId: string | null) {
  return useQuery<Agent[]>({
    queryKey: ['agents', projectId],
    queryFn: () => api.get(`/v1/projects/${projectId}/agents`),
    enabled: !!projectId,
    staleTime: 10 * 1000,
  });
}

export function useAgent(id: string | null) {
  return useQuery<Agent | null>({
    queryKey: ['agent', id],
    queryFn: () => api.get(`/v1/agents/${id}`),
    enabled: !!id,
  });
}

export function useCreateAgent(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAgent) =>
      api.post<Agent>(`/v1/projects/${projectId}/agents`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', projectId] });
    },
  });
}

export function useUpdateAgent(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAgent }) =>
      api.put<Agent | null>(`/v1/agents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', projectId] });
    },
  });
}

export function useDeleteAgent(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', projectId] });
    },
  });
}

export function useClassifyTest(projectId: string | null) {
  return useMutation({
    mutationFn: (text: string) =>
      api.post<ClassifyTestResponse>(`/v1/projects/${projectId}/classify`, { text }),
  });
}
