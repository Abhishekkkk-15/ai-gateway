import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SidebarProvider, SidebarInset } from './components/ui/sidebar.js';
import { AppSidebar } from './components/layout/AppSidebar.js';
import { SiteHeader } from './components/layout/SiteHeader.js';
import { Toaster } from './components/ui/sonner.js';
import { LoginPage } from './pages/LoginPage.js';
import { api } from './lib/api.js';
import { Spinner } from './components/ui/spinner.js';

const OverviewPage = lazy(() =>
  import('./pages/OverviewPage.js').then((module) => ({ default: module.OverviewPage }))
);
const ProvidersPage = lazy(() =>
  import('./pages/ProvidersPage.js').then((module) => ({ default: module.ProvidersPage }))
);
const ModelsPage = lazy(() =>
  import('./pages/ModelsPage.js').then((module) => ({ default: module.ModelsPage }))
);
const KeysPage = lazy(() =>
  import('./pages/KeysPage.js').then((module) => ({ default: module.KeysPage }))
);
const PlaygroundPage = lazy(() =>
  import('./pages/PlaygroundPage.js').then((module) => ({ default: module.PlaygroundPage }))
);
const LogsPage = lazy(() =>
  import('./pages/LogsPage.js').then((module) => ({ default: module.LogsPage }))
);

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner className="text-primary" />
      <span>Loading view...</span>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="animate-fade-in motion-reduce:animate-none">
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
    </div>
  );
}

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
        <Spinner className="text-primary" />
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
        <SidebarInset className="app-surface">
          <SiteHeader loadedModelsCount={loadedModelsCount} />
          <main className="flex-1 w-full">
            <AppRoutes />
          </main>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </BrowserRouter>
  );
}
