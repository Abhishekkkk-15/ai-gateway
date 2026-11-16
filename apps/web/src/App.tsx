import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { LoginPage } from './pages/LoginPage.js';
import { ProvidersPage } from './pages/ProvidersPage.js';
import { ModelsPage } from './pages/ModelsPage.js';
import { KeysPage } from './pages/KeysPage.js';
import { PlaygroundPage } from './pages/PlaygroundPage.js';
import { LogsPage } from './pages/LogsPage.js';
import { api } from './lib/api.js';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState('admin');
  const [currentTab, setCurrentTab] = useState('providers');

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onLogout={handleLogout}
        username={username}
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'providers' && <ProvidersPage />}
        {currentTab === 'models' && <ModelsPage />}
        {currentTab === 'keys' && <KeysPage />}
        {currentTab === 'playground' && <PlaygroundPage />}
        {currentTab === 'logs' && <LogsPage />}
      </main>
    </div>
  );
}
