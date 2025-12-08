'use client';

import { FolderOpen } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { Project } from '@/types/api';

interface ProjectFilterProps {
  projects: Project[] | undefined;
  isLoading: boolean;
  value: string | undefined;
  onChange: (projectId: string | undefined) => void;
}

export function ProjectFilter({
  projects,
  isLoading,
  value,
  onChange,
}: ProjectFilterProps) {
  if (isLoading) {
    return <Skeleton className="h-9 w-[180px]" />;
  }

  return (
    <Select
      value={value ?? 'all'}
      onValueChange={(v) => onChange(v === 'all' ? undefined : v)}
    >
      <SelectTrigger className="w-[180px] h-9">
        <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
        <SelectValue placeholder="All projects" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All projects</SelectItem>
        {projects?.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
