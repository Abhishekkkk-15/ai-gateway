import React from 'react';
import { Layers, Key, Cpu, Play, Activity, LogOut, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Button.js';
import { Badge } from './ui/Badge.js';

export interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  username?: string;
}

export function Navbar({ currentTab, onTabChange, onLogout, username = 'admin' }: NavbarProps) {
  const navItems = [
    { id: 'providers', label: 'Providers', icon: Layers },
    { id: 'models', label: 'Models & Aliases', icon: Cpu },
    { id: 'keys', label: 'Gateway Keys', icon: Key },
    { id: 'playground', label: 'Playground', icon: Play },
    { id: 'logs', label: 'Telemetry Logs', icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange('providers')}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20">
              ⚡
            </div>
            <div>
              <span className="text-base font-bold tracking-tight">AI Gateway</span>
              <span className="ml-2 text-xs font-mono text-muted-foreground">v1.0</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-secondary text-primary'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          <Badge variant="success" className="flex items-center space-x-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>Operational</span>
          </Badge>
          <span className="text-xs font-mono text-muted-foreground hidden sm:inline">{username}</span>
          <Button variant="ghost" size="sm" onClick={onLogout} title="Log Out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
