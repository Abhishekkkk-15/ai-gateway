import React from 'react';
import { useTheme } from '../context/ThemeContext.js';
import { Button } from './ui/button.js';
import { Sun, Moon, Laptop } from 'lucide-react';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, isDark } = useTheme();

  const cycleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('dark');
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className={`size-8 text-muted-foreground hover:text-foreground ${className || ''}`}
      title={`Theme: ${theme}. Click to toggle.`}
      type="button"
      aria-label="Toggle theme"
    >
      {theme === 'system' ? (
        <Laptop className="size-4" />
      ) : isDark ? (
        <Moon className="size-4 text-sky-400" />
      ) : (
        <Sun className="size-4 text-amber-500" />
      )}
    </Button>
  );
}
