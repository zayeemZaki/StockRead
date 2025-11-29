import { createClient } from '@/lib/supabase-server';
import { Navbar } from '@/components/navbar';
import { InteractiveChart, ExpandableAbout } from '@/components/features';
import { FeedManager } from '@/components/feed-manager';
import { getStockDetails } from '@/app/actions/get-stock-details';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        <main className="min-h-screen bg-background text-foreground pt-0 md:pt-16 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
            <Card className="bg-card border border-border w-full max-w-md">
              <CardContent className="py-12 md:py-16 text-center">
                <AlertCircle className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground/50 mx-auto mb-3 md:mb-4" />
                <h3 className="text-xl md:text-2xl font-bold mb-2">Stock Not Found</h3>
                <p className="text-muted-foreground text-sm md:text-lg">
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
      <main className="min-h-screen bg-background text-foreground pt-0 md:pt-16 pb-20 md:pb-8">
        <div className="max-w-7xl mx-auto">
          {/* MOBILE HEADER - Compact & Bold */}
          <div className="md:hidden bg-card border-b border-border pt-2">
            <div className="px-3 py-2 space-y-1">
              {/* Top Row: Logo + Symbol + Price */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {(() => {
                    const stockInfo = POPULAR_STOCKS.find(s => s.symbol === upperSymbol);
                    const domain = stockInfo?.domain || profile.website;
                    return <CompanyLogo ticker={upperSymbol} domain={domain} size="md" />;
                  })()}
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base font-bold leading-tight">{upperSymbol}</h1>
                    <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                      {profile.longName}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold leading-tight">
                    ${profile.currentPrice?.toFixed(2) || 'N/A'}
                  </div>
                  <div className={`text-[11px] font-semibold ${priceChangeColor} mt-0.5`}>
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                    <span className="text-[9px] text-muted-foreground ml-0.5">(1Y)</span>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Market Cap + Sector */}
              <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-border/50">
                {profile.marketCap && (
                  <div>
                    <span className="text-muted-foreground">Market Cap: </span>
                    <span className="font-semibold">${(profile.marketCap / 1e9).toFixed(2)}B</span>
                  </div>
                )}
                {profile.sector && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    {profile.sector}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* DESKTOP HEADER */}
          <Card className="hidden md:block bg-card border border-border shadow-lg mx-4 sm:mx-6 lg:mx-8 mt-6">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* LEFT COLUMN: Stock Summary Sidebar */}
                <div className="lg:col-span-3 space-y-4">
                  {/* Logo Section */}
                  <div className="flex flex-col items-center text-center space-y-3">
                    {(() => {
                      const stockInfo = POPULAR_STOCKS.find(s => s.symbol === upperSymbol);
                      const domain = stockInfo?.domain || profile.website;
                      return <CompanyLogo ticker={upperSymbol} domain={domain} size="xl" />;
                    })()}
                    
                    <div>
                      <h1 className="text-xl font-bold">{upperSymbol}</h1>
                      <p className="text-base text-muted-foreground mt-1">
                        {profile.longName}
                      </p>
                    </div>
                  </div>

                  {/* Price Section */}
                  <div className="text-center space-y-2 py-4 border-y border-border">
                    <div className="text-2xl font-bold">
                      ${profile.currentPrice?.toFixed(2) || 'N/A'}
                    </div>
                    <div className={`text-lg font-semibold flex items-center justify-center gap-2 ${priceChangeColor}`}>
                      <TrendingUp className="w-4 h-4" />
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

          {/* MOBILE CHART - Full Width */}
          <div className="md:hidden">
            <Card className="bg-card border-0 border-b border-border rounded-none">
              <CardContent className="pl-2 pr-0 py-2">
                <InteractiveChart ticker={upperSymbol} initialData={chart} />
              </CardContent>
            </Card>
          </div>

          {/* MOBILE: Key Facts Summary */}
          <div className="md:hidden px-4 py-1.5 space-y-2" id="company-details">
            {/* About Section - Expandable */}
            {profile.longBusinessSummary && (
              <ExpandableAbout 
                symbol={upperSymbol} 
                summary={profile.longBusinessSummary} 
              />
            )}

            {/* Quick Facts Grid - 2 columns on mobile */}
            <Card className="bg-card border border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Company Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {/* Sector */}
                  {profile.sector && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                        Sector
                      </div>
                      <div className="text-xs font-semibold">{profile.sector}</div>
                    </div>
                  )}

                  {/* Industry */}
                  {profile.industry && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                        Industry
                      </div>
                      <div className="text-xs font-semibold">{profile.industry}</div>
                    </div>
                  )}

                  {/* Employees */}
                  {profile.fullTimeEmployees && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                        Employees
                      </div>
                      <div className="text-xs font-semibold">
                        {profile.fullTimeEmployees.toLocaleString('en-US')}
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  {location && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                        HQ
                      </div>
                      <div className="text-xs font-semibold line-clamp-2">{location}</div>
                    </div>
                  )}
                </div>

                {/* Website - Full Width */}
                {profile.website && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                      Website
                    </div>
                    <a 
                      href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <Globe className="w-3 h-3" />
                      {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* DESKTOP & MOBILE: Community Feed */}
          <div className="px-0 md:px-4 sm:px-6 lg:px-8 md:mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 md:gap-6">
              {/* LEFT COLUMN: Community Feed (2/3 width on desktop, full width on mobile) */}
              <div className="lg:col-span-2">
                <Card className="bg-card border-0 md:border border-border md:shadow-lg rounded-none md:rounded-lg">
                  <CardHeader className="px-4 md:px-6 py-4">
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />
                      Community Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-0 md:px-6">
                    {posts && posts.length > 0 ? (
                      <FeedManager 
                        initialPosts={posts} 
                        viewerId={viewer?.id || null}
                        liveInsightsMap={insightsMap}
                      />
                    ) : (
                      <div className="py-12 md:py-16 text-center px-4">
                        <MessageSquare className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground/50 mx-auto mb-3 md:mb-4" />
                        <h3 className="text-lg md:text-xl font-bold mb-2">No Analysis Yet</h3>
                        <p className="text-sm md:text-base text-muted-foreground">
                          Be the first to analyze {upperSymbol}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT COLUMN: Company Profile (1/3 width - DESKTOP ONLY) */}
              <div className="hidden lg:block space-y-6">
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
        </div>
      </main>
    </>
  );
}
