import { LucideIcon } from 'lucide-react';
import { ComponentType } from 'react';

export interface PluginRoute {
  path: string;
  label: string;
  component: ComponentType;
}

export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  routes: PluginRoute[];
  navGroup?: string;
}

export interface PluginConfig {
  enabled: boolean;
}

import { semanticPlugin } from './semantic';
import { slackPlugin } from './slack';

export const plugins: PluginDefinition[] = [
  semanticPlugin,
  slackPlugin,
];

export function getEnabledPlugins(): PluginDefinition[] {
  return plugins;
}

export function getPluginById(id: string): PluginDefinition | undefined {
  return plugins.find(p => p.id === id);
}

export function getPluginRoutes(): Array<{ pluginId: string; route: PluginRoute }> {
  return plugins.flatMap(plugin =>
    plugin.routes.map(route => ({ pluginId: plugin.id, route }))
  );
}
