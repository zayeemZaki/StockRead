'use server';

export interface ChartDataPoint {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

const rangeConfig: Record<string, { period1: Date; interval: string }> = {
  '1D': { 
    period1: new Date(new Date().setDate(new Date().getDate() - 1)), 
    interval: '5m' 
  },
  '5D': { 
    period1: new Date(new Date().setDate(new Date().getDate() - 5)), 
    interval: '15m' 
  },
  '1M': { 
    period1: new Date(new Date().setMonth(new Date().getMonth() - 1)), 
    interval: '1d' 
  },
  '6M': { 
    period1: new Date(new Date().setMonth(new Date().getMonth() - 6)), 
    interval: '1d' 
  },
  'YTD': { 
    period1: new Date(new Date().getFullYear(), 0, 1), 
    interval: '1d' 
  },
  '1Y': { 
    period1: new Date(new Date().setFullYear(new Date().getFullYear() - 1)), 
    interval: '1d' 
  },
  '5Y': { 
    period1: new Date(new Date().setFullYear(new Date().getFullYear() - 5)), 
    interval: '1wk' 
  }
};

export async function getChartData(ticker: string, range: string): Promise<ChartDataPoint[] | null> {
  try {
    // Dynamic import and instantiate YahooFinance
    const YahooFinanceModule = await import('yahoo-finance2');
    const YahooFinance = YahooFinanceModule.default;
    const yahooFinance = new YahooFinance();

    const config = rangeConfig[range];
    if (!config) {
      throw new Error(`Invalid range: ${range}`);
    }

    // Fetch chart data with specified period1 and interval
    const chartResult = await yahooFinance.chart(ticker, {
      period1: config.period1,
      interval: config.interval as any
    }) as any;

    // Format chart data for Recharts
    const chartData: ChartDataPoint[] = (chartResult.quotes || []).map((quote: any) => ({
      date: range === '1D' || range === '5D' 
        ? quote.date.toISOString() // Full timestamp for intraday
        : quote.date.toISOString().split('T')[0], // Just date for daily+
      close: quote.close || 0,
      open: quote.open || 0,
      high: quote.high || 0,
      low: quote.low || 0,
      volume: quote.volume || 0
    }));

    return chartData;
  } catch (error: any) {
    console.error(`Error fetching chart data for ${ticker} (${range}):`, error?.message || error);
    return null;
  }
}
