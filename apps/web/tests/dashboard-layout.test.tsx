// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppSidebar } from '../src/components/layout/AppSidebar.js';
import { SiteHeader } from '../src/components/layout/SiteHeader.js';
import { SidebarProvider } from '../src/components/ui/sidebar.js';
import { ThemeProvider } from '../src/context/ThemeContext.js';

describe('Dashboard-01 Shell (AppSidebar & SiteHeader)', () => {
  it('renders navigation links and user profile', () => {
    const onLogout = vi.fn();

    render(
      <BrowserRouter>
        <ThemeProvider>
          <SidebarProvider>
            <AppSidebar onLogout={onLogout} username="admin" />
          </SidebarProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByText('AI Gateway')).toBeDefined();
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('AI Providers')).toBeDefined();
    expect(screen.getByText('Models Catalog')).toBeDefined();
    expect(screen.getByText('Playground')).toBeDefined();
    expect(screen.getByText('Telemetry Logs')).toBeDefined();
  });

  it('renders SiteHeader with breadcrumbs and live model count', () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <SidebarProvider>
            <SiteHeader activeTabTitle="Overview & Telemetry" loadedModelsCount={42} />
          </SidebarProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByText('Overview & Telemetry')).toBeDefined();
    expect(screen.getByText('42 Models Live')).toBeDefined();
  });
});
