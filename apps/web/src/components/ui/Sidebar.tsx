import React, { createContext, useContext, useState, useEffect } from 'react';
import { PanelLeft } from 'lucide-react';
import { Button } from './Button.js';

interface SidebarContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
  state: 'expanded' | 'collapsed';
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export function SidebarProvider({
  children,
  defaultOpen = true,
  className = '',
  style,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [openMobile, setOpenMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setOpenMobile((prev) => !prev);
    } else {
      setOpen((prev) => !prev);
    }
  };

  const state = open ? 'expanded' : 'collapsed';

  return (
    <SidebarContext.Provider
      value={{
        open,
        setOpen,
        openMobile,
        setOpenMobile,
        isMobile,
        toggleSidebar,
        state,
      }}
    >
      <div
        style={style}
        className={`group/sidebar-wrapper flex min-h-screen w-full has-data-[variant=inset]:bg-sidebar ${className}`}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  children,
  className = '',
  variant = 'inset',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: 'inset' | 'sidebar' | 'floating';
}) {
  const { open, isMobile, openMobile, setOpenMobile } = useSidebar();

  if (isMobile) {
    return (
      <>
        {openMobile && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={() => setOpenMobile(false)}
          />
        )}
        <aside
          data-variant={variant}
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-2xl transition-transform duration-200 ease-in-out ${
            openMobile ? 'translate-x-0' : '-translate-x-full'
          } ${className}`}
        >
          {children}
        </aside>
      </>
    );
  }

  return (
    <aside
      data-variant={variant}
      className={`relative hidden md:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200 ease-in-out ${
        open ? 'w-64' : 'w-16'
      } ${className}`}
    >
      {children}
    </aside>
  );
}

export function SidebarTrigger({
  className = '',
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`size-7 text-muted-foreground hover:text-foreground ${className}`}
      onClick={toggleSidebar}
      type="button"
      {...props}
    >
      <PanelLeft className="size-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

export function SidebarInset({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`relative flex min-h-screen flex-1 flex-col bg-background transition-all duration-200 md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm ${className}`}
    >
      {children}
    </main>
  );
}

export function SidebarHeader({
  children,
  className = '',
}: React.ComponentProps<'div'>) {
  return (
    <div className={`flex flex-col gap-2 p-4 border-b border-sidebar-border/60 ${className}`}>
      {children}
    </div>
  );
}

export function SidebarContent({
  children,
  className = '',
}: React.ComponentProps<'div'>) {
  return (
    <div className={`flex flex-1 flex-col gap-2 overflow-y-auto p-3 ${className}`}>
      {children}
    </div>
  );
}

export function SidebarFooter({
  children,
  className = '',
}: React.ComponentProps<'div'>) {
  return (
    <div className={`flex flex-col gap-2 p-3 border-t border-sidebar-border/60 mt-auto ${className}`}>
      {children}
    </div>
  );
}

export function SidebarGroup({
  children,
  className = '',
}: React.ComponentProps<'div'>) {
  return <div className={`flex flex-col gap-1.5 ${className}`}>{children}</div>;
}

export function SidebarGroupLabel({
  children,
  className = '',
}: React.ComponentProps<'div'>) {
  const { open } = useSidebar();
  if (!open) return null;
  return (
    <div className={`px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 ${className}`}>
      {children}
    </div>
  );
}

export function SidebarGroupContent({
  children,
  className = '',
}: React.ComponentProps<'div'>) {
  return <div className={`flex flex-col gap-1 ${className}`}>{children}</div>;
}

export function SidebarMenu({
  children,
  className = '',
}: React.ComponentProps<'ul'>) {
  return <ul className={`flex flex-col gap-1 list-none p-0 m-0 ${className}`}>{children}</ul>;
}

export function SidebarMenuItem({
  children,
  className = '',
}: React.ComponentProps<'li'>) {
  return <li className={`list-none ${className}`}>{children}</li>;
}

export function SidebarMenuButton({
  children,
  isActive = false,
  className = '',
  tooltip,
  ...props
}: React.ComponentProps<'button'> & {
  isActive?: boolean;
  tooltip?: string;
}) {
  const { open } = useSidebar();
  return (
    <button
      type="button"
      title={!open ? tooltip : undefined}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm font-semibold'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
      } ${!open ? 'justify-center px-2' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
