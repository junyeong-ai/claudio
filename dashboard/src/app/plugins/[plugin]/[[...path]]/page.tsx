import { notFound } from 'next/navigation';
import { getPluginById } from '@/plugins';

interface PluginPageProps {
  params: Promise<{
    plugin: string;
    path?: string[];
  }>;
}

export default async function PluginPage({ params }: PluginPageProps) {
  const { plugin: pluginId, path = [] } = await params;
  const plugin = getPluginById(pluginId);

  if (!plugin) {
    notFound();
  }

  const routePath = path.join('/');
  const route = plugin.routes.find(r => r.path === routePath);

  if (!route) {
    notFound();
  }

  const Component = route.component;
  return <Component />;
}
