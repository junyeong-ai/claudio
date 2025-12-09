import { Search } from 'lucide-react';
import type { PluginDefinition } from '../index';
import { SemanticSearchPage } from './SearchPage';
import { SourcesPage } from './SourcesPage';
import { IndexPage } from './IndexPage';

export const semanticPlugin: PluginDefinition = {
  id: 'semantic',
  name: 'Semantic Search',
  description: 'Search and manage semantic search index',
  icon: Search,
  navGroup: 'Plugins',
  routes: [
    { path: '', label: 'Search', component: SemanticSearchPage },
    { path: 'sources', label: 'Sources', component: SourcesPage },
    { path: 'overview', label: 'Overview', component: IndexPage },
  ],
};
