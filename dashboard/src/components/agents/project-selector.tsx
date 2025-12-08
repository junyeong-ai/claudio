'use client';

import { Plus, FolderOpen, Settings } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Project } from '@/types/api';

interface ProjectSelectorProps {
  projects: Project[] | undefined;
  isLoading: boolean;
  value: string | null;
  onChange: (projectId: string) => void;
  onCreateProject: () => void;
  onEditProject: () => void;
}

export function ProjectSelector({
  projects,
  isLoading,
  value,
  onChange,
  onCreateProject,
  onEditProject,
}: ProjectSelectorProps) {
  if (isLoading) {
    return <Skeleton className="h-10 w-[240px]" />;
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="w-[240px]">
          <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Select project" />
        </SelectTrigger>
        <SelectContent>
          {projects?.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value && (
        <Button variant="ghost" size="icon" onClick={onEditProject} aria-label="Edit project settings">
          <Settings className="h-4 w-4" />
        </Button>
      )}

      <Button variant="outline" size="sm" onClick={onCreateProject}>
        <Plus className="h-4 w-4 mr-1" />
        New Project
      </Button>
    </div>
  );
}
