import { Search } from 'lucide-react';
import type { PluginDefinition } from '../index';
import { SemanticSearchPage } from './SearchPage';

export const semanticPlugin: PluginDefinition = {
  id: 'semantic',
  name: 'Semantic Search',
  description: 'Search documents using semantic similarity',
  icon: Search,
  navGroup: 'Plugins',
  routes: [
    {
      path: '',
      label: 'Search',
      component: SemanticSearchPage,
    },
  ],
};
