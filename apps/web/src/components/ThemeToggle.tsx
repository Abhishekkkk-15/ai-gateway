import React from 'react';
import { useTheme } from '../context/ThemeContext.js';
import { Button } from './ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.js';
import { Sun, Moon, Laptop, Check } from 'lucide-react';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun, iconClass: 'text-warning' },
  { value: 'dark', label: 'Dark', icon: Moon, iconClass: 'text-info' },
  { value: 'system', label: 'System', icon: Laptop, iconClass: 'text-muted-foreground' },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, isDark } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`size-8 text-muted-foreground hover:text-foreground ${className || ''}`}
          title={`Theme: ${theme}`}
          type="button"
          aria-label="Change theme"
        >
          {theme === 'system' ? (
            <Laptop className="size-4" />
          ) : isDark ? (
            <Moon className="size-4 text-info" />
          ) : (
            <Sun className="size-4 text-warning" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(({ value, label, icon: Icon, iconClass }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className="cursor-pointer gap-2"
          >
            <Icon className={`size-4 ${iconClass}`} />
            <span>{label}</span>
            {theme === value && <Check className="ml-auto size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
