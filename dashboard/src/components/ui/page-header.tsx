'use client';

import { motion } from 'motion/react';
import { transitions } from '@/lib/animations';
import type { ReactNode } from 'react';

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  as?: HeadingLevel;
}

const headingStyles: Record<HeadingLevel, string> = {
  h1: 'text-3xl font-bold tracking-tight',
  h2: 'text-2xl font-bold tracking-tight',
  h3: 'text-xl font-semibold',
  h4: 'text-lg font-semibold',
};

export function PageHeader({ title, description, actions, as: Heading = 'h1' }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.spring}
      className="flex items-center justify-between"
    >
      <div>
        <Heading className={headingStyles[Heading]}>{title}</Heading>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
