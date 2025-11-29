import { createClient } from '@/lib/supabase-server';
import { Navbar } from '@/components/navbar';
import { CreatePost, MarketSidebar } from '@/components/features';
import { FeedManager } from '@/components/feed-manager';
import Link from 'next/link';

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
  
  // Fetch initial posts (first page only)
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      *,
      author_username,
      author_avatar,
      comments ( id ),
      reactions ( user_id )
    `)
    .order('created_at', { ascending: false })
    .range(0, 9);

  if (error) {
    return (
      <div className="p-10 text-destructive">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">Error loading feed</h2>
            <p className="text-sm">{error.message}</p>
            {error.code && (
              <p className="text-xs text-muted-foreground mt-1">Error code: {error.code}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const mappedPosts = (posts || []).map(post => ({
    ...post,
    profiles: {
      username: post.author_username || 'Unknown',
      avatar_url: post.author_avatar || null
    }
  }));

  // Fetch global AI insights
  const { data: tickerInsights } = await supabase
    .from('ticker_insights')
    .select('ticker, ai_score, ai_signal, ai_risk');
  
  const insightsMap: Record<string, { ai_score: number; ai_signal: string; ai_risk: string }> = {};
  (tickerInsights || []).forEach(insight => {
    insightsMap[insight.ticker] = {
      ai_score: insight.ai_score,
      ai_signal: insight.ai_signal,
      ai_risk: insight.ai_risk
    };
  });

  const sortedPosts = mappedPosts || [];

  return (
    <>
      <Navbar />
      {/* Feed Layout with bottom padding for mobile tab bar */}
      <main className="min-h-screen bg-background text-foreground pt-16 pb-24 md:pb-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
            <div className="md:col-span-8">
              {/* Desktop Create Post */}
              <div className="hidden md:block">
                <CreatePost />
              </div>

              <FeedManager 
                initialPosts={sortedPosts} 
                viewerId={user?.id || null}
                followingIds={followingIds}
                liveInsightsMap={insightsMap}
              />
            </div>

            <aside className="hidden md:block md:col-span-4">
              <MarketSidebar />
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}