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
  } catch {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPositive = (change: number) => change >= 0;

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex flex-col pt-0 md:pt-16 bg-background pb-20 md:pb-6">
        <div className="flex-1 max-w-[1600px] mx-auto w-full">
          
          {/* MOBILE LAYOUT */}
          <div className="lg:hidden">
            {/* Page Header - Mobile */}
            <div className="px-4 pt-4 pb-3">
              <h1 className="text-2xl font-bold mb-1">Markets</h1>
              <p className="text-xs text-muted-foreground">Live market data and latest financial news</p>
            </div>

            {/* Horizontal Scrolling Stock Prices - Mobile Only */}
            <div className="mb-4">
              <div className="px-4 mb-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <h2 className="text-sm font-semibold">Live Prices</h2>
                </div>
              </div>
              
              {isLoadingPrices ? (
                <div className="px-4 text-center py-3 text-muted-foreground text-xs">
                  Loading prices...
                </div>
              ) : stockPrices.length === 0 ? (
                <div className="px-4 text-center py-3 text-muted-foreground text-xs">
                  No price data available
                </div>
              ) : (
                <div className="overflow-x-auto scrollbar-hide">
                  <div className="flex gap-2 px-4 pb-2">
                    {stockPrices.map((stock) => {
                      const positive = isPositive(stock.change_percent);
                      const stockInfo = POPULAR_STOCKS.find(s => s.symbol === stock.symbol);

                      return (
                        <Link
                          key={stock.symbol}
                          href={`/ticker/${stock.symbol}`}
                          className="flex-shrink-0"
                        >
                          <Card className="w-32 bg-card border-border hover:border-primary/50 transition-colors">
                            <CardContent className="p-2.5">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                {stockInfo && (
                                  <StockLogo 
                                    ticker={stock.symbol} 
                                    domain={stockInfo.domain} 
                                    size="sm" 
                                  />
                                )}
                                <span className="font-bold text-xs text-foreground">
                                  {stock.symbol}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-sm font-bold text-foreground">
                                  ${stock.price.toFixed(2)}
                                </div>
                                <Badge 
                                  variant={positive ? 'default' : 'destructive'}
                                  className={`text-[10px] px-1 py-0 h-4 w-fit ${
                                    positive 
                                      ? 'bg-bullish/20 text-bullish border-bullish/50' 
                                      : 'bg-bearish/20 text-bearish border-bearish/50'
                                  }`}
                                >
                                  <span className="flex items-center gap-0.5">
                                    {positive ? (
                                      <TrendingUp className="w-2.5 h-2.5" />
                                    ) : (
                                      <TrendingDown className="w-2.5 h-2.5" />
                                    )}
                                    {positive ? '+' : ''}{stock.change_percent.toFixed(2)}%
                                  </span>
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Market News - Mobile */}
            <div className="px-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Newspaper className="w-3.5 h-3.5 text-primary" />
                <h2 className="text-sm font-semibold">Market News</h2>
                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4">
                  {news.length}
                </Badge>
              </div>

              {isLoadingNews ? (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  Loading news...
                </div>
              ) : news.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="pt-4 text-center text-muted-foreground">
                    <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-xs">No news available at the moment</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {news.map((item) => (
                    <Card key={item.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-2 space-y-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Badge variant="outline" className="bg-primary/5 text-[10px] px-1.5 py-0 h-4">
                                {item.source || 'Market News'}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Calendar className="w-2.5 h-2.5" />
                                {formatDate(item.published_at)}
                              </span>
                            </div>
                            <CardTitle className="text-sm font-semibold text-foreground leading-tight">
                              {item.title}
                            </CardTitle>
                            {item.summary && (
                              <CardDescription className="mt-1 text-xs line-clamp-2">
                                {item.summary}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Globe className="w-2.5 h-2.5" />
                            <span>{item.source || 'Unknown Source'}</span>
                          </div>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="gap-1 text-[10px] h-6 px-2"
                          >
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Read More
                              <ExternalLink className="w-2.5 h-2.5" />
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

          {/* DESKTOP LAYOUT */}
          <div className="hidden lg:block h-screen overflow-hidden">
            {/* Page Header - Desktop */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <h1 className="text-3xl font-bold mb-2">Markets</h1>
              <p className="text-muted-foreground">Live market data and latest financial news</p>
            </div>

            <div className="grid grid-cols-10 h-[calc(100vh-120px)]">
              {/* Left Column: Market News Wire */}
              <div className="col-span-7 overflow-y-auto border-r border-border scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Newspaper className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold">Market News Wire</h2>
                    <Badge variant="secondary" className="ml-auto text-sm">
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
                                  <Badge variant="outline" className="bg-primary/5 text-sm">
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

              {/* Right Column: Live Market Prices */}
              <div className="col-span-3 overflow-y-auto bg-muted/20 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold">Live Prices</h2>
                    <Badge variant="secondary" className="ml-auto text-sm">
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
                                        size="sm" 
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
        </div>
      </main>
    </>
  );
}
