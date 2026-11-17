import React from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarTrigger } from '../ui/sidebar.js';
import { Separator } from '../ui/separator.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { ThemeToggle } from '../ThemeToggle.js';
import { ExternalLink } from 'lucide-react';

const ROUTE_TITLES: Record<string, string> = {
  '/overview': 'Overview',
  '/providers': 'Providers',
  '/models': 'Models',
  '/keys': 'API Keys',
  '/playground': 'Playground',
  '/logs': 'Logs',
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
    activeTabTitle || ROUTE_TITLES[location.pathname] || 'Overview';

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mx-1 h-4" />
          <nav className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Gateway</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-medium text-foreground">{currentTitle}</span>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="hidden font-normal sm:inline-flex">
            {loadedModelsCount} models enabled
          </Badge>

          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden text-muted-foreground hover:text-foreground md:inline-flex"
          >
            <a
              href="https://platform.openai.com/docs/api-reference"
              target="_blank"
              rel="noopener noreferrer"
            >
              API Specs
              <ExternalLink />
            </a>
          </Button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
