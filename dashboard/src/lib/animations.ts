import type { Variants, Transition } from 'motion/react';

export const transitions = {
  spring: { type: 'spring', stiffness: 400, damping: 30 } as Transition,
  springGentle: { type: 'spring', stiffness: 300, damping: 25 } as Transition,
  fast: { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] } as Transition,
  medium: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } as Transition,
} as const;

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: transitions.spring },
};

export const staggerItemScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: transitions.spring },
};

export const expandCollapse: Variants = {
  hidden: { height: 0, opacity: 0 },
  visible: {
    height: 'auto',
    opacity: 1,
    transition: { height: { duration: 0.25 }, opacity: { duration: 0.2, delay: 0.05 } },
  },
};

export const reducedMotionStagger: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};

export const reducedMotionItem: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};
