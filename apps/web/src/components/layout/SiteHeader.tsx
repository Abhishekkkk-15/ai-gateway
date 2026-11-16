import React from 'react';
import { SidebarTrigger } from '../ui/Sidebar.js';
import { Separator } from '../ui/Separator.js';
import { Badge } from '../ui/Badge.js';
import { Button } from '../ui/Button.js';
import { ThemeToggle } from '../ThemeToggle.js';
import { ExternalLink, Zap } from 'lucide-react';

export function SiteHeader({
  activeTabTitle = 'Overview',
  loadedModelsCount = 0,
}: {
  activeTabTitle?: string;
  loadedModelsCount?: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/80 bg-background/80 px-4 backdrop-blur-md transition-all">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4 mx-1" />
          <nav className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Gateway</span>
            <span className="text-muted-foreground/60">/</span>
            <span className="font-semibold text-foreground capitalize">{activeTabTitle}</span>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 py-0.5 text-[11px] font-mono border-border bg-card">
            <Zap className="size-3 text-amber-500 fill-amber-500/20" />
            <span>{loadedModelsCount} Models Live</span>
          </Badge>

          <Separator orientation="vertical" className="h-4 hidden sm:block" />

          <Button variant="ghost" size="sm" asChild className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <span>Docs</span>
              <ExternalLink className="size-3" />
            </a>
          </Button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
