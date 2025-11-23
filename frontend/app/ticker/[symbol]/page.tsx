import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Post } from '@/types';
import { Navbar } from '@/components/navbar';
import { InteractiveChart } from '@/components/features';
import { FeedManager } from '@/components/feed-manager';
import { getStockDetails } from '@/app/actions/get-stock-details';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StockLogo } from '@/components/ui/stock-logo';
import { CompanyLogo } from '@/components/ui/company-logo';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, Globe, MapPin, TrendingUp, AlertCircle, MessageSquare } from 'lucide-react';
import { POPULAR_STOCKS } from '@/lib/tickers';

interface TickerPageProps {
  params: Promise<{
    symbol: string;
  }>;
}

export default async function TickerPage({ params }: TickerPageProps) {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  // Fetch deep stock details
  const details = await getStockDetails(upperSymbol);

  // Stock not found fallback
  if (!details) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-background text-foreground pt-24 pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <Card className="bg-card border border-border">
              <CardContent className="py-16 text-center">
                <AlertCircle className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Stock Not Found</h3>
                <p className="text-muted-foreground text-lg">
                  Unable to fetch data for {upperSymbol}
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }

  const { chart, profile } = details;

  // Get viewer ID for post interactions
  const { data: { user: viewer } } = await supabase.auth.getUser();

  // Fetch community posts for this ticker
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      *,
      profiles ( username, avatar_url ),
      comments ( id ),
      reactions ( user_id )
    `)
    .ilike('ticker', upperSymbol)
    .order('created_at', { ascending: false });

  // Fetch live AI insights for this ticker
  const { data: tickerInsights } = await supabase
    .from('ticker_insights')
    .select('ticker, ai_score, ai_signal, ai_risk');
  
  // Create insights map
  const insightsMap: Record<string, { ai_score: number; ai_signal: string; ai_risk: string }> = {};
  (tickerInsights || []).forEach(insight => {
    insightsMap[insight.ticker] = {
      ai_score: insight.ai_score,
      ai_signal: insight.ai_signal,
      ai_risk: insight.ai_risk
    };
  });

  // Format company location
  const location = [profile.city, profile.state, profile.country]
    .filter(Boolean)
    .join(', ');

  // Calculate price change
  const priceChange = chart.length > 1 
    ? ((chart[chart.length - 1].close - chart[0].close) / chart[0].close) * 100 
    : 0;
  const priceChangeColor = priceChange >= 0 ? 'text-bullish' : 'text-bearish';

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground pt-24 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* TOP SECTION: Combined Header & Chart - Side by Side */}
          <Card className="bg-card border border-border shadow-lg">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT COLUMN: Stock Summary Sidebar */}
                <div className="lg:col-span-3 space-y-6">
                  {/* Logo Section */}
                  <div className="flex flex-col items-center text-center space-y-4">
                    {(() => {
                      const stockInfo = POPULAR_STOCKS.find(s => s.symbol === upperSymbol);
                      const domain = stockInfo?.domain || profile.website;
                      return <CompanyLogo ticker={upperSymbol} domain={domain} size="xl" />;
                    })()}
                    
                    <div>
                      <h1 className="text-3xl font-bold">{upperSymbol}</h1>
                      <p className="text-lg text-muted-foreground mt-1">
                        {profile.longName}
                      </p>
                    </div>
                  </div>

                  {/* Price Section */}
                  <div className="text-center space-y-3 py-6 border-y border-border">
                    <div className="text-5xl font-bold">
                      ${profile.currentPrice?.toFixed(2) || 'N/A'}
                    </div>
                    <div className={`text-xl font-semibold flex items-center justify-center gap-2 ${priceChangeColor}`}>
                      <TrendingUp className="w-5 h-5" />
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                      <span className="text-sm text-muted-foreground">(1Y)</span>
                    </div>
                  </div>

                  {/* Market Cap Section */}
                  {profile.marketCap && (
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Market Cap
                      </div>
                      <div className="text-2xl font-bold">
                        ${(profile.marketCap / 1e9).toFixed(2)}B
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: Chart */}
                <div className="lg:col-span-9">
                  <InteractiveChart ticker={upperSymbol} initialData={chart} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2-COLUMN GRID: Left (Social Feed) + Right (Company Info) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT COLUMN: Community Feed (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-card border border-border shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Community Sentiment & AI Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {posts && posts.length > 0 ? (
                    <FeedManager 
                      initialPosts={posts} 
                      viewerId={viewer?.id || null}
                      liveInsightsMap={insightsMap}
                    />
                  ) : (
                    <div className="py-16 text-center">
                      <MessageSquare className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                      <h3 className="text-xl font-bold mb-2">No Analysis Yet</h3>
                      <p className="text-muted-foreground">
                        Be the first to analyze {upperSymbol}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: Company Profile (1/3 width) */}
            <div className="space-y-6">
              {/* About Section */}
              <Card className="bg-card border border-border shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="w-5 h-5" />
                    About
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {profile.longBusinessSummary || 'No company description available.'}
                  </p>
                </CardContent>
              </Card>

              {/* Key Facts Section */}
              <Card className="bg-card border border-border shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Key Facts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Sector */}
                    {profile.sector && (
                      <div className="flex items-start gap-3">
                        <Building2 className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider">Sector</div>
                          <div className="text-sm font-medium">{profile.sector}</div>
                        </div>
                      </div>
                    )}

                    {/* Industry */}
                    {profile.industry && (
                      <div className="flex items-start gap-3">
                        <Building2 className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider">Industry</div>
                          <div className="text-sm font-medium">{profile.industry}</div>
                        </div>
                      </div>
                    )}

                    {/* Employees */}
                    {profile.fullTimeEmployees && (
                      <div className="flex items-start gap-3">
                        <Users className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider">Employees</div>
                          <div className="text-sm font-medium">
                            {profile.fullTimeEmployees.toLocaleString('en-US')}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* HQ Location */}
                    {location && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider">Headquarters</div>
                          <div className="text-sm font-medium">{location}</div>
                        </div>
                      </div>
                    )}

                    {/* Website */}
                    {profile.website && (
                      <div className="flex items-start gap-3">
                        <Globe className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider">Website</div>
                          <a 
                            href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
