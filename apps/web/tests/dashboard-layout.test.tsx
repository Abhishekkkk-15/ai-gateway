import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppSidebar } from '../src/components/layout/AppSidebar.js';
import { SiteHeader } from '../src/components/layout/SiteHeader.js';
import { SidebarProvider } from '../src/components/ui/Sidebar.js';
import { ThemeProvider } from '../src/context/ThemeContext.js';

describe('Dashboard-01 Shell (AppSidebar & SiteHeader)', () => {
  it('renders navigation tabs and switches active tab on click', () => {
    const onSelectTab = vi.fn();
    const onLogout = vi.fn();

    render(
      <ThemeProvider>
        <SidebarProvider>
          <AppSidebar
            activeTab="overview"
            onSelectTab={onSelectTab}
            onLogout={onLogout}
            username="admin"
          />
        </SidebarProvider>
      </ThemeProvider>
    );

    expect(screen.getByText('AI Gateway')).toBeDefined();
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('AI Providers')).toBeDefined();
    expect(screen.getByText('Models Catalog')).toBeDefined();

    fireEvent.click(screen.getByText('AI Providers'));
    expect(onSelectTab).toHaveBeenCalledWith('providers');

    fireEvent.click(screen.getByText('Sign Out'));
    expect(onLogout).toHaveBeenCalled();
  });

  it('renders SiteHeader with breadcrumbs and live model count', () => {
    render(
      <ThemeProvider>
        <SidebarProvider>
          <SiteHeader activeTabTitle="Overview & Telemetry" loadedModelsCount={42} />
        </SidebarProvider>
      </ThemeProvider>
    );

    expect(screen.getByText('Overview & Telemetry')).toBeDefined();
    expect(screen.getByText('42 Models Live')).toBeDefined();
  });
});
