import React from 'react';
import { cn } from '../../lib/utils.js';

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <div className={cn('w-full', className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          // @ts-expect-error cloneElement injects tab context
          return React.cloneElement(child, { activeTab: value, setActiveTab: onValueChange });
        }
        return child;
      })}
    </div>
  );
}

export function TabsList({
  children,
  className,
  activeTab,
  setActiveTab,
}: {
  children: React.ReactNode;
  className?: string;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}) {
  return (
    <div className={cn('inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground', className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          // @ts-expect-error pass tab context
          return React.cloneElement(child, { activeTab, setActiveTab });
        }
        return child;
      })}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  activeTab,
  setActiveTab,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}) {
  const isActive = activeTab === value;
  return (
    <button
      type="button"
      onClick={() => setActiveTab?.(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive ? 'bg-background text-foreground shadow' : 'hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  activeTab,
  className,
}: {
  value: string;
  children: React.ReactNode;
  activeTab?: string;
  className?: string;
}) {
  if (activeTab !== value) return null;
  return <div className={cn('mt-4 focus-visible:outline-none', className)}>{children}</div>;
}
