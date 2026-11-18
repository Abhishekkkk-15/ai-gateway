import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog.js';
import { Input } from '../ui/input.js';
import { cn } from '../../lib/utils.js';
import {
  LayoutDashboard,
  Cpu,
  Layers,
  KeyRound,
  Play,
  ScrollText,
  Search,
  Copy,
  CornerDownLeft,
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'overview',
        label: 'Overview',
        hint: 'Metrics and traffic',
        keywords: 'dashboard home stats',
        icon: LayoutDashboard,
        run: () => navigate('/overview'),
      },
      {
        id: 'providers',
        label: 'AI Providers',
        hint: 'Upstream connections',
        keywords: 'upstream keys config',
        icon: Cpu,
        run: () => navigate('/providers'),
      },
      {
        id: 'models',
        label: 'Models',
        hint: 'Routing table',
        keywords: 'catalog routing enabled',
        icon: Layers,
        run: () => navigate('/models'),
      },
      {
        id: 'keys',
        label: 'API Keys',
        hint: 'Gateway access',
        keywords: 'tokens credentials',
        icon: KeyRound,
        run: () => navigate('/keys'),
      },
      {
        id: 'playground',
        label: 'Playground',
        hint: 'Test a completion',
        keywords: 'chat test request',
        icon: Play,
        run: () => navigate('/playground'),
      },
      {
        id: 'logs',
        label: 'Telemetry Logs',
        hint: 'Recent requests',
        keywords: 'requests traces latency',
        icon: ScrollText,
        run: () => navigate('/logs'),
      },
      {
        id: 'copy-base-url',
        label: 'Copy API base URL',
        hint: `${window.location.origin}/v1`,
        keywords: 'clipboard endpoint openai',
        icon: Copy,
        run: async () => {
          try {
            await navigator.clipboard.writeText(`${window.location.origin}/v1`);
            toast.success('API base URL copied');
          } catch {
            toast.error('Could not copy to clipboard');
          }
        },
      },
    ],
    [navigate]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(q) || command.keywords.includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    const node = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const select = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    void command.run();
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (results.length ? (index + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) =>
        results.length ? (index - 1 + results.length) % results.length : 0
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(results[activeIndex]);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-8 items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground md:inline-flex"
        aria-label="Open command palette"
      >
        <Search className="size-3.5" />
        <span>Search</span>
        <kbd className="ml-2 rounded border border-border/70 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[18%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0 sm:rounded-xl [&>button:last-child]:hidden">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <DialogDescription className="sr-only">
            Search pages and quick actions
          </DialogDescription>

          <div className="relative border-b border-border/70">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search pages and actions..."
              className="h-12 rounded-none border-0 bg-transparent pl-11 pr-4 text-sm shadow-none focus-visible:ring-0"
              autoFocus
            />
          </div>

          <div ref={listRef} className="max-h-[320px] overflow-y-auto p-1.5 custom-scrollbar">
            {results.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matches for “{query}”
              </div>
            ) : (
              results.map((command, index) => {
                const Icon = command.icon;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={command.id}
                    type="button"
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => select(command)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground/90 hover:bg-accent/60'
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-4 shrink-0',
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    <span className="flex-1 truncate">{command.label}</span>
                    <span className="hidden truncate text-xs text-muted-foreground sm:block">
                      {command.hint}
                    </span>
                    {isActive && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border/70 bg-muted/50 px-1 py-0.5 font-mono">↑</kbd>
              <kbd className="rounded border border-border/70 bg-muted/50 px-1 py-0.5 font-mono">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border/70 bg-muted/50 px-1 py-0.5 font-mono">↵</kbd>
              open
            </span>
            <span className="ml-auto flex items-center gap-1">
              <kbd className="rounded border border-border/70 bg-muted/50 px-1 py-0.5 font-mono">esc</kbd>
              close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
