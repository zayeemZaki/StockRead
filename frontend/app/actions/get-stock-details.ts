'use server';

export interface StockChart {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export interface StockProfile {
  symbol: string;
  longName: string;
  shortName: string;
  sector?: string;
  industry?: string;
  website?: string;
  fullTimeEmployees?: number;
  city?: string;
  state?: string;
  country?: string;
  longBusinessSummary?: string;
  currentPrice?: number;
  marketCap?: number;
}

export interface StockDetails {
  chart: StockChart[];
  profile: StockProfile;
}

export async function getStockDetails(ticker: string): Promise<StockDetails | null> {
  try {
    // Dynamic import and instantiate YahooFinance
    const YahooFinanceModule = await import('yahoo-finance2');
    const YahooFinance = YahooFinanceModule.default;
    const yahooFinance = new YahooFinance();

    // Fetch chart data (1 year of daily data)
    const chartResult = await yahooFinance.chart(ticker, {
      period1: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
      interval: '1d'
    }) as any;

    // Fetch profile and price data
    const summaryResult = await yahooFinance.quoteSummary(ticker, {
      modules: ['summaryProfile', 'price']
    }) as any;

    // Format chart data
    const chart: StockChart[] = (chartResult.quotes || []).map((quote: any) => ({
      date: quote.date.toISOString().split('T')[0],
      close: quote.close || 0,
      open: quote.open || 0,
      high: quote.high || 0,
      low: quote.low || 0,
      volume: quote.volume || 0
    }));

    // Format profile data
    const summaryProfile = summaryResult.summaryProfile || {};
    const priceData = summaryResult.price || {};

    const profile: StockProfile = {
      symbol: ticker.toUpperCase(),
      longName: priceData.longName || ticker,
      shortName: priceData.shortName || ticker,
      sector: summaryProfile.sector,
      industry: summaryProfile.industry,
      website: summaryProfile.website,
      fullTimeEmployees: summaryProfile.fullTimeEmployees,
      city: summaryProfile.city,
      state: summaryProfile.state,
      country: summaryProfile.country,
      longBusinessSummary: summaryProfile.longBusinessSummary,
      currentPrice: priceData.regularMarketPrice,
      marketCap: priceData.marketCap
    };

    return {
      chart,
      profile
    };
  } catch (error: any) {
    // Suppress console warnings and errors for cleaner logs
    console.error(`Error fetching stock details for ${ticker}:`, error?.message || error);
    return null;
  }
}
