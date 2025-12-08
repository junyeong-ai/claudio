'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  BarChart3,
  MessageSquareHeart,
  Workflow,
  Cpu,
  AlertTriangle,
  Bot,
  History,
  GitBranch,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getEnabledPlugins } from '@/plugins';

const menuItems = [
  { title: 'Overview', url: '/', icon: LayoutDashboard },
  { title: 'Agents', url: '/agents', icon: Bot },
  { title: 'History', url: '/history', icon: History },
  { title: 'Users', url: '/users', icon: Users },
  { title: 'Analytics', url: '/analytics', icon: BarChart3 },
  { title: 'Classify', url: '/classify', icon: GitBranch },
  { title: 'Feedback', url: '/feedback', icon: MessageSquareHeart },
  { title: 'Workflows', url: '/workflows', icon: Workflow },
  { title: 'Models', url: '/models', icon: Cpu },
  { title: 'Errors', url: '/errors', icon: AlertTriangle },
];

export function AppSidebar() {
  const pathname = usePathname();
  const plugins = getEnabledPlugins();

  const pluginsByGroup = plugins.reduce((acc, plugin) => {
    const group = plugin.navGroup || 'Plugins';
    if (!acc[group]) acc[group] = [];
    acc[group].push(plugin);
    return acc;
  }, {} as Record<string, typeof plugins>);

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Bot className="h-6 w-6" />
          <span className="font-semibold">Claudio</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className={cn(pathname === item.url && 'bg-sidebar-accent')}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {Object.entries(pluginsByGroup).map(([group, groupPlugins]) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {groupPlugins.map((plugin) => {
                  const pluginUrl = `/plugins/${plugin.id}`;
                  const isActive = pathname.startsWith(pluginUrl);
                  const Icon = plugin.icon;

                  return (
                    <SidebarMenuItem key={plugin.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={cn(isActive && 'bg-sidebar-accent')}
                      >
                        <Link href={pluginUrl}>
                          <Icon className="h-4 w-4" />
                          <span>{plugin.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <p className="text-xs text-muted-foreground">Claudio Dashboard v1.0</p>
      </SidebarFooter>
    </Sidebar>
  );
}
