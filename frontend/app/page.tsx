import { createClient } from '@/lib/supabase-server';
import { Post } from '@/types';
import { Navbar } from '@/components/navbar';
import { CreatePost, MarketSidebar } from '@/components/features';
import { FeedManager } from '@/components/feed-manager';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Fetch the list of users the current user follows
  let followingIds: string[] = [];
  if (user) {
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);
    
    followingIds = following?.map(f => f.following_id) || [];
  }
  
  // Fetch initial posts (first page only - infinite scroll will load more)
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles ( username, avatar_url ),
      comments ( id ),
      reactions ( user_id )
    `)
    .order('created_at', { ascending: false })
    .range(0, 9); // First 10 posts (page 0, limit 10)

  if (error) {
    return <div className="p-10 text-red-500">Error loading feed: {error.message}</div>;
  }

  // Fetch global AI insights from ticker_insights table
  const { data: tickerInsights } = await supabase
    .from('ticker_insights')
    .select('ticker, ai_score, ai_signal, ai_risk');
  
  console.log('Server: Fetched ticker insights:', tickerInsights?.length || 0);
  
  // Create a plain object for serialization (Maps can't be passed to client components)
  const insightsMap: Record<string, { ai_score: number; ai_signal: string; ai_risk: string }> = {};
  (tickerInsights || []).forEach(insight => {
    insightsMap[insight.ticker] = {
      ai_score: insight.ai_score,
      ai_signal: insight.ai_signal,
      ai_risk: insight.ai_risk
    };
  });
  
  console.log('Server: insightsMap keys:', Object.keys(insightsMap).slice(0, 10));
  console.log('Server: AAPL insight:', insightsMap['AAPL']);

  // Posts are already sorted by newest first from the query
  // (Friend-first sorting removed for infinite scroll pagination simplicity)
  const sortedPosts = posts || [];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground pt-24 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Bloomberg-style 2-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Main Feed (70% on desktop) */}
            <div className="md:col-span-8">
              <CreatePost />
              
              <FeedManager 
                initialPosts={sortedPosts} 
                viewerId={user?.id || null}
                followingIds={followingIds}
                liveInsightsMap={insightsMap}
              />
            </div>

            {/* Right Column: Market Sidebar (30% on desktop, hidden on mobile) */}
            <aside className="hidden md:block md:col-span-4">
              <MarketSidebar />
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}