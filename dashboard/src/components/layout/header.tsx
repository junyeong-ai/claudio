'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { usePathname } from 'next/navigation';

const routeLabels: Record<string, string> = {
  '': 'Dashboard',
  'analytics': 'Analytics',
  'agents': 'Agents',
  'feedback': 'Feedback',
  'workflows': 'Workflows',
  'models': 'Models',
  'errors': 'Errors',
  'history': 'History',
  'users': 'Users',
  'classify': 'Classify',
  'plugins': 'Plugins',
  'slack': 'Slack',
  'semantic': 'Semantic Search',
};

function formatSegment(segment: string): string {
  return routeLabels[segment] || segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface BreadcrumbSegment {
  label: string;
  href: string;
  isLast: boolean;
}

function generateBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  if (pathname === '/') return [];

  const segments = pathname.split('/').filter(Boolean);

  return segments.map((segment, index) => ({
    label: formatSegment(decodeURIComponent(segment)),
    href: '/' + segments.slice(0, index + 1).join('/'),
    isLast: index === segments.length - 1,
  }));
}

export function Header() {
  const pathname = usePathname();
  const breadcrumbs = useMemo(() => generateBreadcrumbs(pathname), [pathname]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            {breadcrumbs.length === 0 ? (
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link href="/">Dashboard</Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          {breadcrumbs.map((crumb) => (
            <BreadcrumbItem key={crumb.href}>
              <BreadcrumbSeparator />
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
