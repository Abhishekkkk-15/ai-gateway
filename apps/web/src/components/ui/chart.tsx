import React from 'react';
import { ResponsiveContainer } from 'recharts';

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
    theme?: Record<string, string>;
  }
>;

export function ChartContainer({
  id,
  className = '',
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  id?: string;
  config: ChartConfig;
  children: React.ReactNode;
}) {
  const chartId = React.useId();

  return (
    <div
      data-chart={id || chartId}
      className={`flex aspect-video justify-center text-xs ${className}`}
      {...props}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export interface ChartTooltipItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
}

export function ChartTooltip({
  active,
  payload,
  label,
  indicator = 'dot',
  valueFormatter,
  renderFooter,
}: {
  active?: boolean;
  payload?: ChartTooltipItem[];
  label?: string;
  indicator?: 'dot' | 'line';
  valueFormatter?: (value: number | string) => React.ReactNode;
  renderFooter?: (payload: ChartTooltipItem[]) => React.ReactNode;
}) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/60 bg-popover/95 p-2.5 text-xs shadow-xl backdrop-blur-md">
      {label && <div className="font-semibold text-foreground mb-1">{label}</div>}
      <div className="flex flex-col gap-1">
        {payload.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {indicator === 'dot' && (
                <div
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
              )}
              {indicator === 'line' && (
                <div
                  className="h-0.5 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span>{item.name || item.dataKey}</span>
            </div>
            <span className="font-mono font-medium text-foreground">
              {valueFormatter && item.value !== undefined
                ? valueFormatter(item.value)
                : item.value}
            </span>
          </div>
        ))}
      </div>
      {renderFooter && payload.length > 0 && (
        <div className="mt-0.5 border-t border-border/60 pt-1.5 text-[11px]">
          {renderFooter(payload)}
        </div>
      )}
    </div>
  );
}
