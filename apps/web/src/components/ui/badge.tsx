import React from 'react';
import { cn } from '../../lib/utils.js';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'border-transparent bg-primary/15 text-primary hover:bg-primary/25',
    secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'border-transparent bg-destructive/15 text-destructive hover:bg-destructive/25',
    outline: 'text-foreground border-border',
    success: 'border-transparent bg-success/15 text-success hover:bg-success/25',
    warning: 'border-transparent bg-warning/15 text-warning hover:bg-warning/25',
    info: 'border-transparent bg-info/15 text-info hover:bg-info/25',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
