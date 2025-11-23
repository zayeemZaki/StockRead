'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SidebarSkeleton } from '@/components/ui';
import { StockLogo } from '@/components/ui/stock-logo';
import { POPULAR_STOCKS } from '@/lib/tickers';
import { TrendingUp, TrendingDown, Newspaper, ExternalLink } from 'lucide-react';

// Helper function to format news dates safely
function formatNewsDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Today';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (error) {
    return 'Today';
  }
}

interface NewsItem {
  id: number;
  title: string;
  url: string;
  source: string;
  published_at: string;
  created_at: string;
}

interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  previous_close: number;
  updated_at: string;
}

export function MarketSidebar() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [stockPrices, setStockPrices] = useState<Record<string, StockPrice>>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const supabase = createClient();

  const isPositive = (change: number) => change >= 0;

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const { data, error } = await supabase
          .from('market_news')
          .select('id, title, url, source, published_at, created_at')
          .order('published_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('❌ Supabase error fetching news:', error);
          setNews([]);
        } else {
          setNews(data || []);
        }
      } catch (error) {
        console.error('❌ Error fetching news:', error);
        setNews([]);
      } finally {
        setIsLoadingNews(false);
      }
    };

    const fetchStockPrices = async () => {
      try {
        const { data, error } = await supabase
          .from('market_prices')
          .select('*')
          .order('symbol', { ascending: true });

        if (error) {
          console.error('❌ Supabase error fetching prices:', error);
          setStockPrices({});
        } else {
          // Convert array to object keyed by symbol
          const pricesMap: Record<string, StockPrice> = {};
          data?.forEach((stock) => {
            pricesMap[stock.symbol] = stock;
          });
          
          setStockPrices(pricesMap);
        }
      } catch (error) {
        console.error('❌ Error fetching stock prices:', error);
        setStockPrices({});
      } finally {
        setIsLoadingPrices(false);
      }
    };

    fetchNews();
    fetchStockPrices();

    // Set up Realtime subscription for live price updates
    const priceChannel = supabase
      .channel('market_prices_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'market_prices'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newStock = payload.new as StockPrice;
            
            setStockPrices((prev) => ({
              ...prev,
              [newStock.symbol]: newStock
            }));
          } else if (payload.eventType === 'DELETE') {
            const oldStock = payload.old as { symbol: string };
            
            setStockPrices((prev) => {
              const updated = { ...prev };
              delete updated[oldStock.symbol];
              return updated;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('🔌 Unsubscribing from realtime updates');
      supabase.removeChannel(priceChannel);
    };
  }, []);

  // Calculate market summary
  const totalStocks = POPULAR_STOCKS.length;
  const loadedStocks = Object.keys(stockPrices).length;
  const gainers = Object.values(stockPrices).filter(s => s.change_percent > 0).length;
  const losers = Object.values(stockPrices).filter(s => s.change_percent < 0).length;

  // Show skeleton while both news and prices are loading
  const isLoading = isLoadingNews && isLoadingPrices;

  if (isLoading) {
    return (
      <Card className="h-[calc(100vh-100px)] flex flex-col sticky top-24 overflow-hidden p-6">
        <SidebarSkeleton />
      </Card>
    );
  }

  return (
    <Card className="h-[calc(100vh-100px)] flex flex-col sticky top-24 overflow-hidden">
      {/* Top Section: Stocks (70%) */}
      <div className="h-[70%] flex flex-col min-h-0">
        {/* Fixed Header */}
        <div className="p-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Market Watch
          </h2>
        </div>
        
        {/* Scrollable Stock List */}
        <div className="flex-1 overflow-y-auto min-h-0 p-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          {isLoadingPrices ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <div className="animate-pulse">Loading live prices...</div>
              <div className="text-xs mt-2">Connecting to market data...</div>
            </div>
          ) : loadedStocks === 0 ? (
            <div className="text-center py-8">
              <div className="text-sm text-muted-foreground mb-2">
                No price data available
              </div>
              <div className="text-xs text-muted-foreground">
                Stock price API may be unavailable
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {POPULAR_STOCKS.map((stock, index) => {
                const priceData = stockPrices[stock.symbol];
                
                // Skip if no price data available
                if (!priceData) return null;

                const positive = isPositive(priceData.change_percent);

                return (
                  <Link
                    key={`${stock.symbol}-${index}`}
                    href={`/ticker/${stock.symbol}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    {/* Left: Logo + Symbol */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <StockLogo 
                        ticker={stock.symbol} 
                        domain={stock.domain} 
                        size="md" 
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                          {stock.symbol}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {stock.name}
                        </span>
                      </div>
                    </div>

                    {/* Right: Price + Change */}
                    <div className="flex flex-col items-end ml-2">
                      <span className="text-sm font-semibold text-foreground">
                        ${priceData.price.toFixed(2)}
                      </span>
                      <Badge 
                        variant={positive ? 'default' : 'destructive'}
                        className={`text-xs px-1.5 py-0 h-5 ${
                          positive 
                            ? 'bg-bullish/20 text-bullish border-bullish/50 hover:bg-bullish/30' 
                            : 'bg-bearish/20 text-bearish border-bearish/50 hover:bg-bearish/30'
                        }`}
                      >
                        <span className="flex items-center gap-0.5">
                          {positive ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {positive ? '+' : ''}{priceData.change_percent.toFixed(2)}%
                        </span>
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <Separator />

      {/* Bottom Section: News (30%) */}
      <div className="h-[30%] flex flex-col min-h-0">
        {/* Fixed Header */}
        <div className="p-4 border-b border-border shrink-0">
          <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Newspaper className="w-4 h-4 text-primary" />
            Trending News
          </h2>
        </div>

        {/* Scrollable News List */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          {isLoadingNews ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              Loading news...
            </div>
          ) : news.length > 0 ? (
            news.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-2 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <p className="text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 flex items-start gap-1">
                  <span className="flex-1 truncate">{item.title}</span>
                  <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {item.source || 'Market News'}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {formatNewsDate(item.published_at)}
                  </span>
                </div>
              </a>
            ))
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4">
              No news available
            </div>
          )}
        </div>

        {/* Footer - Pinned at Bottom */}
        <div className="p-4 border-t border-border shrink-0 bg-card">
          <Link 
            href="/markets" 
            className="text-xs text-primary hover:underline font-medium flex items-center justify-center gap-1"
          >
            View All Markets →
          </Link>
        </div>
      </div>
    </Card>
  );
}
