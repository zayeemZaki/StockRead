'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StockLogo } from '@/components/ui/stock-logo';
import { POPULAR_STOCKS } from '@/lib/tickers';
import { Newspaper, TrendingUp, TrendingDown, ExternalLink, Calendar, Globe } from 'lucide-react';
import Link from 'next/link';

interface NewsItem {
  id: number;
  title: string;
  url: string;
  source: string;
  published_at: string;
  summary?: string;
  created_at?: string;
}

interface StockPrice {
  symbol: string;
  price: number;
  change_percent: number;
  updated_at: string;
}

// Helper function to format news dates safely
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Today';
    }
    
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (error) {
    return 'Today';
  }
}

export default function MarketsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [stockPrices, setStockPrices] = useState<StockPrice[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const { data, error } = await supabase
          .from('market_news')
          .select('*')
          .order('published_at', { ascending: false })
          .limit(50);

        if (!error && data) {
          setNews(data);
        }
      } catch (error) {
        console.error('Error fetching news:', error);
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

        if (!error && data) {
          setStockPrices(data);
        }
      } catch (error) {
        console.error('Error fetching stock prices:', error);
      } finally {
        setIsLoadingPrices(false);
      }
    };

    fetchNews();
    fetchStockPrices();

    // Set up realtime subscription for stock prices
    const priceChannel = supabase
      .channel('market_prices_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'market_prices'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newStock = payload.new as StockPrice;
            setStockPrices((prev) => {
              const index = prev.findIndex(s => s.symbol === newStock.symbol);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = newStock;
                return updated;
              } else {
                return [...prev, newStock].sort((a, b) => a.symbol.localeCompare(b.symbol));
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(priceChannel);
    };
  }, []);

  const isPositive = (change: number) => change >= 0;

  return (
    <>
      <Navbar />
      <main className="h-screen flex flex-col pt-16 bg-background overflow-hidden">
        {/* Page Header */}
        <div className="border-b border-border bg-muted/30 shrink-0">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Markets</h1>
            <p className="text-muted-foreground">Live market data and latest financial news</p>
          </div>
        </div>

        {/* Split Layout - Fixed Height */}
        <div className="flex-1 max-w-[1600px] mx-auto w-full overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-10 h-full">
            {/* Left Column: Market News Wire (70%) */}
            <div className="lg:col-span-7 overflow-y-auto border-r border-border scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Newspaper className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">Market News Wire</h2>
                  <Badge variant="secondary" className="ml-auto">
                    {news.length} Articles
                  </Badge>
                </div>

                {isLoadingNews ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading news...
                  </div>
                ) : news.length === 0 ? (
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No news available at the moment</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {news.map((item) => (
                      <Card key={item.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-primary/5">
                                  {item.source || 'Market News'}
                                </Badge>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(item.published_at)}
                                </span>
                              </div>
                              <CardTitle className="text-lg font-semibold text-foreground leading-tight">
                                {item.title}
                              </CardTitle>
                              {item.summary && (
                                <CardDescription className="mt-2 text-sm line-clamp-2">
                                  {item.summary}
                                </CardDescription>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Globe className="w-3 h-3" />
                              <span>{item.source || 'Unknown Source'}</span>
                            </div>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="gap-2"
                            >
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Read More
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Live Market Prices (30%) */}
            <div className="lg:col-span-3 overflow-y-auto bg-muted/20 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">Live Prices</h2>
                  <Badge variant="secondary" className="ml-auto">
                    {stockPrices.length}
                  </Badge>
                </div>

                {isLoadingPrices ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading prices...
                  </div>
                ) : stockPrices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No price data available
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stockPrices.map((stock) => {
                      const positive = isPositive(stock.change_percent);
                      const stockInfo = POPULAR_STOCKS.find(s => s.symbol === stock.symbol);

                      return (
                        <Link
                          key={stock.symbol}
                          href={`/ticker/${stock.symbol}`}
                          className="block"
                        >
                          <Card className="bg-card border-border hover:border-primary/50 transition-colors">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                {/* Left: Logo + Info */}
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {stockInfo && (
                                    <StockLogo 
                                      ticker={stock.symbol} 
                                      domain={stockInfo.domain} 
                                      size="md" 
                                    />
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-sm text-foreground">
                                      {stock.symbol}
                                    </span>
                                    {stockInfo && (
                                      <span className="text-xs text-muted-foreground truncate">
                                        {stockInfo.name}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Right: Price + Change */}
                                <div className="flex flex-col items-end ml-2">
                                  <span className="text-base font-bold text-foreground">
                                    ${stock.price.toFixed(2)}
                                  </span>
                                  <Badge 
                                    variant={positive ? 'default' : 'destructive'}
                                    className={`text-xs px-2 py-0.5 h-5 ${
                                      positive 
                                        ? 'bg-bullish/20 text-bullish border-bullish/50' 
                                        : 'bg-bearish/20 text-bearish border-bearish/50'
                                    }`}
                                  >
                                    <span className="flex items-center gap-1">
                                      {positive ? (
                                        <TrendingUp className="w-3 h-3" />
                                      ) : (
                                        <TrendingDown className="w-3 h-3" />
                                      )}
                                      {positive ? '+' : ''}{stock.change_percent.toFixed(2)}%
                                    </span>
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
