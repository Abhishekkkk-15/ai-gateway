import React from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '../ui/Sidebar.js';
import {
  LayoutDashboard,
  Cpu,
  Layers,
  KeyRound,
  Play,
  ScrollText,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

export type NavTab = 'overview' | 'providers' | 'models' | 'keys' | 'playground' | 'logs';

export function AppSidebar({
  activeTab,
  onSelectTab,
  onLogout,
  username = 'admin',
}: {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onLogout: () => void;
  username?: string;
}) {
  const { open } = useSidebar();

  const navItems: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'providers', label: 'AI Providers', icon: Cpu },
    { id: 'models', label: 'Models Catalog', icon: Layers },
    { id: 'keys', label: 'Gateway API Keys', icon: KeyRound },
    { id: 'playground', label: 'Playground', icon: Play },
    { id: 'logs', label: 'Telemetry Logs', icon: ScrollText },
  ];

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm shrink-0">
            ⚡
          </div>
          {open && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-tight truncate">AI Gateway</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Hot-Path Active</span>
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onSelectTab(item.id)}
                      tooltip={item.label}
                    >
                      <Icon className={`size-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      {open && <span className="truncate">{item.label}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-col gap-2">
          {open && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-sidebar-accent/40 text-xs">
              <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{username}</span>
                <span className="text-[10px] text-muted-foreground">Admin Session</span>
              </div>
            </div>
          )}
          <SidebarMenuButton
            onClick={onLogout}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            tooltip="Sign Out"
          >
            <LogOut className="size-4 shrink-0" />
            {open && <span>Sign Out</span>}
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
