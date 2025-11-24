'use client';

import { useState, useTransition } from 'react';
import { getChartData, ChartDataPoint } from '@/app/actions/get-chart-data';
import { StockChart } from './stock-chart';
import { Loader2 } from 'lucide-react';

interface InteractiveChartProps {
  ticker: string;
  initialData: ChartDataPoint[];
}

const timeRanges = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y'] as const;
type TimeRange = typeof timeRanges[number];

export function InteractiveChart({ ticker, initialData }: InteractiveChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>(initialData);
  const [activeRange, setActiveRange] = useState<TimeRange>('1Y');
  const [isPending, startTransition] = useTransition();

  // Get previous close (second to last data point)
  const previousClose = data.length > 1 ? data[data.length - 2].close : undefined;

  const handleRangeChange = async (range: TimeRange) => {
    if (range === activeRange || isPending) return;

    setActiveRange(range);
    
    startTransition(async () => {
      try {
        const newData = await getChartData(ticker, range);
        
        if (newData && newData.length > 0) {
          setData(newData);
        } else {
          console.warn(`No data returned for ${ticker} ${range}, keeping existing data`);
        }
      } catch (error) {
        console.error(`Error fetching ${range} chart data:`, error);
      }
    });
  };

  return (
    <div className="space-y-1.5 md:space-y-4">
      {/* Time Range Tabs */}
      <div className="flex items-center justify-end gap-1.5">
        <div className="text-[10px] md:text-sm text-muted-foreground flex-shrink-0">
          {isPending && (
            <div className="flex items-center gap-1 md:gap-2">
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
              <span className="hidden md:inline">Loading...</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-0.5 md:gap-1 bg-muted/50 rounded-md p-0.5 md:p-1">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => handleRangeChange(range)}
              disabled={isPending}
              className={`px-1 md:px-3 py-0.5 md:py-1 rounded text-[9px] md:text-sm font-medium transition-all disabled:opacity-50 ${
                range === activeRange
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className={isPending ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        <StockChart data={data} previousClose={previousClose} range={activeRange} />
      </div>
    </div>
  );
}
