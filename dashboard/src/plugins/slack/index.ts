import { MessageSquare } from 'lucide-react';
import type { PluginDefinition } from '../index';
import { SlackPage } from './SlackPage';

export const slackPlugin: PluginDefinition = {
  id: 'slack',
  name: 'Slack',
  description: 'Search users, channels, and view messages',
  icon: MessageSquare,
  navGroup: 'Plugins',
  routes: [
    {
      path: '',
      label: 'Slack',
      component: SlackPage,
    },
  ],
};
