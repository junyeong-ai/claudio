'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { getPluginById } from '@/plugins';

function PluginContent() {
  const params = useParams();
  const router = useRouter();

  const pluginId = params.plugin as string;
  const pathSegments = params.path as string[] | undefined;
  const currentPath = pathSegments?.join('/') || '';

  const plugin = getPluginById(pluginId);

  if (!plugin) {
    notFound();
  }

  const route = plugin.routes.find((r) => r.path === currentPath);

  if (!route) {
    notFound();
  }

  const Component = route.component;
  const showTabs = plugin.routes.length > 1;

  const handleTabChange = (value: string) => {
    const basePath = `/plugins/${pluginId}`;
    router.push(value ? `${basePath}/${value}` : basePath);
  };

  return (
    <div className="space-y-6">
      {showTabs && (
        <Tabs value={currentPath} onValueChange={handleTabChange}>
          <TabsList>
            {plugin.routes.map((r) => (
              <TabsTrigger key={r.path} value={r.path}>
                {r.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Component />
      </Suspense>
    </div>
  );
}

export default function PluginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <PluginContent />
    </Suspense>
  );
}
