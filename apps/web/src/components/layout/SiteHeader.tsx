import React from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarTrigger } from '../ui/sidebar.js';
import { Separator } from '../ui/separator.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { ThemeToggle } from '../ThemeToggle.js';
import { ExternalLink, Zap } from 'lucide-react';

const ROUTE_TITLES: Record<string, string> = {
  '/overview': 'Overview & Telemetry',
  '/providers': 'AI Providers',
  '/models': 'Models Catalog',
  '/keys': 'Gateway API Keys',
  '/playground': 'Interactive Playground',
  '/logs': 'Telemetry Logs',
};

export function SiteHeader({
  activeTabTitle,
  loadedModelsCount = 0,
}: {
  activeTabTitle?: string;
  loadedModelsCount?: number;
}) {
  const location = useLocation();
  const currentTitle =
    activeTabTitle || ROUTE_TITLES[location.pathname] || 'Overview & Telemetry';

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/80 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4 mx-1" />
          <nav className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Gateway</span>
            <span className="text-muted-foreground/60">/</span>
            <span className="font-semibold text-foreground">{currentTitle}</span>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="hidden sm:flex items-center gap-1.5 py-0.5 text-[11px] font-mono border-border bg-card"
          >
            <Zap className="size-3 text-amber-500 fill-amber-500/20" />
            <span>{loadedModelsCount} Models Live</span>
          </Badge>

          <Separator orientation="vertical" className="h-4 hidden sm:block" />

          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <a
              href="https://platform.openai.com/docs/api-reference"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>API Specs</span>
              <ExternalLink className="size-3" />
            </a>
          </Button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
