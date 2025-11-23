import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

// Top tickers to fetch - ensure no duplicates
const TOP_TICKERS = Array.from(new Set([
  'NVDA', 'TSLA', 'AAPL', 'AMD', 'MSFT', 'GOOGL', 'AMZN', 'META', 
  'COIN', 'NFLX', 'V', 'JPM', 'WMT', 'DIS', 'PYPL', 'INTC', 'BA', 
  'NKE', 'COST', 'CRM', 'ADBE', 'ORCL', 'CSCO', 'AVGO', 'TXN',
  'QCOM', 'HON', 'UNP', 'UPS', 'SBUX', 'GS', 'BRK-B', 'LLY', 
  'UNH', 'XOM', 'MA', 'JNJ', 'PG', 'HD', 'CVX', 'MRK', 'ABBV',
  'KO', 'PEP', 'MCD', 'TMO', 'ABT', 'ACN', 'VZ'
]));

// Fallback mock data with realistic 2025 prices
const MOCK_FALLBACK = [
  { symbol: 'NVDA', price: 140.23, change: 3.45, changePercent: 2.52 },
  { symbol: 'AAPL', price: 230.50, change: -2.80, changePercent: -1.20 },
  { symbol: 'TSLA', price: 185.60, change: 8.30, changePercent: 4.68 },
  { symbol: 'MSFT', price: 420.75, change: 7.25, changePercent: 1.75 },
  { symbol: 'GOOGL', price: 165.40, change: -1.20, changePercent: -0.72 },
  { symbol: 'AMZN', price: 195.80, change: 4.60, changePercent: 2.40 },
  { symbol: 'META', price: 580.90, change: 12.40, changePercent: 2.18 },
  { symbol: 'AMD', price: 125.30, change: -3.70, changePercent: -2.87 },
  { symbol: 'NFLX', price: 690.45, change: 15.80, changePercent: 2.34 },
  { symbol: 'V', price: 305.60, change: 2.90, changePercent: 0.96 },
  { symbol: 'JPM', price: 215.30, change: -1.50, changePercent: -0.69 },
  { symbol: 'WMT', price: 180.25, change: 1.20, changePercent: 0.67 },
  { symbol: 'DIS', price: 110.80, change: -2.30, changePercent: -2.03 },
  { symbol: 'PYPL', price: 78.50, change: 3.40, changePercent: 4.52 },
  { symbol: 'INTC', price: 38.90, change: -1.20, changePercent: -2.99 },
  { symbol: 'BA', price: 225.40, change: 6.80, changePercent: 3.11 },
  { symbol: 'NKE', price: 95.60, change: -0.90, changePercent: -0.93 },
  { symbol: 'COST', price: 850.20, change: 10.50, changePercent: 1.25 },
  { symbol: 'CRM', price: 340.80, change: 12.60, changePercent: 3.84 },
  { symbol: 'ADBE', price: 520.40, change: -9.80, changePercent: -1.85 },
  { symbol: 'ORCL', price: 160.70, change: 3.50, changePercent: 2.23 },
  { symbol: 'CSCO', price: 62.30, change: -0.80, changePercent: -1.27 },
  { symbol: 'AVGO', price: 1250.60, change: 45.20, changePercent: 3.75 },
  { symbol: 'TXN', price: 205.90, change: 2.80, changePercent: 1.38 },
  { symbol: 'QCOM', price: 175.40, change: -4.20, changePercent: -2.34 },
];

export async function GET() {
  try {
    // Fetch quotes from Yahoo Finance
    const quotes: any = await yahooFinance.quote(TOP_TICKERS);

    // Map to simple format
    const stockData: Record<string, any> = {};

    if (Array.isArray(quotes)) {
      quotes.forEach((quote: any) => {
        if (quote && quote.symbol) {
          stockData[quote.symbol] = {
            symbol: quote.symbol,
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
          };
        }
      });
    } else if (quotes && quotes.symbol) {
      // Single quote returned
      stockData[quotes.symbol] = {
        symbol: quotes.symbol,
        price: quotes.regularMarketPrice || 0,
        change: quotes.regularMarketChange || 0,
        changePercent: quotes.regularMarketChangePercent || 0,
      };
    }

    return NextResponse.json(stockData);

  } catch (error) {
    console.error('❌ Yahoo Finance Error:', error);

    // Return mock data as fallback
    const fallbackData: Record<string, any> = {};
    MOCK_FALLBACK.forEach(stock => {
      fallbackData[stock.symbol] = stock;
    });

    return NextResponse.json(fallbackData, {
      headers: {
        'X-Data-Source': 'mock-fallback',
      },
    });
  }
}
