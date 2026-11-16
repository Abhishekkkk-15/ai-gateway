import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SidebarProvider, SidebarInset } from './components/ui/sidebar.js';
import { AppSidebar } from './components/layout/AppSidebar.js';
import { SiteHeader } from './components/layout/SiteHeader.js';
import { Toaster } from './components/ui/sonner.js';
import { LoginPage } from './pages/LoginPage.js';
import { OverviewPage } from './pages/OverviewPage.js';
import { ProvidersPage } from './pages/ProvidersPage.js';
import { ModelsPage } from './pages/ModelsPage.js';
import { KeysPage } from './pages/KeysPage.js';
import { PlaygroundPage } from './pages/PlaygroundPage.js';
import { LogsPage } from './pages/LogsPage.js';
import { api } from './lib/api.js';
import { Loader2 } from 'lucide-react';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState('admin');

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
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground text-sm font-mono gap-2">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>Connecting to gateway...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
        <Toaster />
      </>
    );
  }

  return (
    <BrowserRouter>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar onLogout={handleLogout} username={username} />
        <SidebarInset>
          <SiteHeader loadedModelsCount={loadedModelsCount} />
          <main className="flex-1 w-full bg-background/50">
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/providers" element={<ProvidersPage />} />
              <Route path="/models" element={<ModelsPage />} />
              <Route path="/keys" element={<KeysPage />} />
              <Route path="/playground" element={<PlaygroundPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </main>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </BrowserRouter>
  );
}
