import React, { useState, useRef, useEffect } from 'react';

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        if (child.type === DropdownMenuTrigger) {
          return React.cloneElement(child as React.ReactElement<{ onClick?: () => void }>, {
            onClick: () => setOpen((prev) => !prev),
          });
        }
        if (child.type === DropdownMenuContent && open) {
          return React.cloneElement(child as React.ReactElement<{ onClose?: () => void }>, {
            onClose: () => setOpen(false),
          });
        }
        return null;
      })}
    </div>
  );
}

export function DropdownMenuTrigger({
  children,
  asChild,
  className = '',
  onClick,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  children,
  className = '',
  align = 'end',
  onClose,
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'end';
  onClose?: () => void;
}) {
  return (
    <div
      className={`absolute z-50 mt-2 min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 ${
        align === 'end' ? 'right-0' : 'left-0'
      } ${className}`}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        if (child.type === DropdownMenuItem) {
          return React.cloneElement(child as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
            onClick: (e: React.MouseEvent) => {
              (child.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
              onClose?.();
            },
          });
        }
        return child;
      })}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  className = '',
  onClick,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator({ className = '' }: { className?: string }) {
  return <div className={`-mx-1 my-1 h-px bg-border ${className}`} />;
}

export function DropdownMenuLabel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`px-2 py-1.5 text-xs font-semibold text-foreground ${className}`}>{children}</div>;
}
