import * as React from 'react';
import { Check, Copy, Terminal, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
}

export const CodeBlock = React.forwardRef<HTMLDivElement, CodeBlockProps>(
  (
    {
      code,
      language,
      filename,
      showLineNumbers = false,
      className,
      ...props
    },
    ref
  ) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        toast.success('Code copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error('Failed to copy code');
      }
    };

    const lines = React.useMemo(() => code.split('\n'), [code]);

    const displayLanguage = language || (filename ? filename.split('.').pop() : undefined);

    return (
      <div
        ref={ref}
        className={cn(
          'group relative rounded-xl border border-border/80 bg-zinc-950 text-zinc-100 shadow-md overflow-hidden font-mono text-xs',
          className
        )}
        {...props}
      >
        {/* Header Bar */}
        {(filename || displayLanguage) && (
          <div className="flex items-center justify-between border-b border-border/40 bg-zinc-900/60 px-4 py-2 text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              {displayLanguage === 'bash' || displayLanguage === 'curl' || displayLanguage === 'sh' ? (
                <Terminal className="size-3.5 text-primary" />
              ) : (
                <Code2 className="size-3.5 text-primary" />
              )}
              {filename ? (
                <span className="font-medium text-zinc-200">{filename}</span>
              ) : (
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 text-[10px] uppercase font-mono border-zinc-700 text-zinc-300 bg-zinc-800/50"
                >
                  {displayLanguage}
                </Badge>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 px-2 text-[11px] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 gap-1.5"
              title="Copy snippet"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-sans">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span className="font-sans">Copy</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Code Content Area */}
        <div className="relative">
          {!filename && !displayLanguage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="absolute right-2 top-2 z-10 h-6 px-2 text-[11px] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 gap-1.5 bg-zinc-900/80 backdrop-blur-sm border border-zinc-800"
              title="Copy snippet"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-sans">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span className="font-sans">Copy</span>
                </>
              )}
            </Button>
          )}

          <pre className="overflow-x-auto p-4 leading-relaxed font-mono">
            {showLineNumbers ? (
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/40">
                      <td className="w-8 select-none pr-4 text-right text-zinc-600 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="whitespace-pre">{line || ' '}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <code className="text-zinc-100 whitespace-pre">{code}</code>
            )}
          </pre>
        </div>
      </div>
    );
  }
);
CodeBlock.displayName = 'CodeBlock';

export function InlineCode({ className, children, ...props }: React.ComponentProps<'code'>) {
  return (
    <code
      className={cn(
        'rounded border border-border/60 bg-muted/70 px-1.5 py-0.5 font-mono text-[11px] text-foreground font-semibold',
        className
      )}
      {...props}
    >
      {children}
    </code>
  );
}
