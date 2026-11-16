import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SidebarProvider, SidebarInset } from './components/ui/Sidebar.js';
import { AppSidebar, type NavTab } from './components/layout/AppSidebar.js';
import { SiteHeader } from './components/layout/SiteHeader.js';
import { LoginPage } from './pages/LoginPage.js';
import { OverviewPage } from './pages/OverviewPage.js';
import { ProvidersPage } from './pages/ProvidersPage.js';
import { ModelsPage } from './pages/ModelsPage.js';
import { KeysPage } from './pages/KeysPage.js';
import { PlaygroundPage } from './pages/PlaygroundPage.js';
import { LogsPage } from './pages/LogsPage.js';
import { api } from './lib/api.js';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState('admin');
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');

  useEffect(() => {
    // Check current auth status on mount
    api
      .getMe()
      .then((res) => {
        setIsAuthenticated(true);
        setUsername(res.user.username);
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  const { data: modelsData } = useQuery({
    queryKey: ['models'],
    queryFn: () => api.getModels(),
    enabled: isAuthenticated === true,
  });

  const loadedModelsCount = modelsData?.models?.filter((m) => m.isEnabled).length || 0;

  const handleLoginSuccess = (user: { username: string }) => {
    setIsAuthenticated(true);
    setUsername(user.username);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
  };

  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground text-sm font-mono">
        Connecting to gateway...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const tabTitles: Record<NavTab, string> = {
    overview: 'Overview & Telemetry',
    providers: 'AI Providers',
    models: 'Models Catalog',
    keys: 'Gateway API Keys',
    playground: 'Interactive Playground',
    logs: 'Telemetry Logs',
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        activeTab={currentTab}
        onSelectTab={setCurrentTab}
        onLogout={handleLogout}
        username={username}
      />
      <SidebarInset>
        <SiteHeader
          activeTabTitle={tabTitles[currentTab]}
          loadedModelsCount={loadedModelsCount}
        />
        <main className="flex-1 w-full bg-background/50">
          {currentTab === 'overview' && (
            <OverviewPage onNavigate={(tab) => setCurrentTab(tab as NavTab)} />
          )}
          {currentTab === 'providers' && <ProvidersPage />}
          {currentTab === 'models' && <ModelsPage />}
          {currentTab === 'keys' && <KeysPage />}
          {currentTab === 'playground' && <PlaygroundPage />}
          {currentTab === 'logs' && <LogsPage />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
