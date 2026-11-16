// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '../src/components/ui/sidebar.js';
import { Separator } from '../src/components/ui/separator.js';
import { Card, CardHeader, CardTitle, CardContent } from '../src/components/ui/card.js';

describe('UI Primitives Smoke Test', () => {
  it('renders Sidebar and SidebarTrigger without crashing', () => {
    render(
      <SidebarProvider defaultOpen={true}>
        <Sidebar>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>Dashboard</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    );

    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByRole('button', { name: /toggle sidebar/i })).toBeDefined();
  });

  it('renders Separator correctly', () => {
    const { container } = render(<Separator orientation="vertical" className="h-4" />);
    expect(container.querySelector('[role="separator"]')).toBeDefined();
  });

  it('renders Card composition cleanly', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Metric Title</CardTitle>
        </CardHeader>
        <CardContent>
          <span>Content Body</span>
        </CardContent>
      </Card>
    );
    expect(screen.getByText('Metric Title')).toBeDefined();
    expect(screen.getByText('Content Body')).toBeDefined();
  });
});
