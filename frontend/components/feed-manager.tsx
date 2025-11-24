'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { Post } from '@/types';
import { PostCard } from '@/components/features';
import { FeedSkeleton } from '@/components/ui';
import { TrendingUp, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { fetchMorePosts } from '@/app/actions/fetch-posts';
import { createClient } from '@/lib/supabase-client';

type FilterType = 'all' | 'trending' | 'bullish' | 'bearish' | 'high-risk';

interface FeedManagerProps {
  initialPosts: Post[];
  viewerId: string | null;
  followingIds?: string[];
  isLoading?: boolean;
  liveInsightsMap?: Record<string, { ai_score: number; ai_signal: string; ai_risk: string }>;
}

export function FeedManager({ initialPosts, viewerId, isLoading = false, liveInsightsMap }: FeedManagerProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [page, setPage] = useState(1); // Start at page 1 (page 0 is initialPosts)
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Convert prop to state for realtime updates
  const [insights, setInsights] = useState(new Map(
    Object.entries(liveInsightsMap || {}).map(([ticker, data]) => [ticker, data])
  ));

  // Update posts when initialPosts changes
  useEffect(() => {
    setPosts(initialPosts);
    setPage(1); // Reset pagination when initial posts change
    setHasMore(true); // Reset hasMore flag
  }, [initialPosts]);

  // Intersection observer for infinite scroll
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '100px', // Start loading 100px before the element comes into view
  });

  // Fetch more posts when the bottom element comes into view
  const loadMorePosts = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    try {
      const result = await fetchMorePosts(page, 10);
      
      if (result.error) {
        console.error('Error loading more posts:', result.error);
        setHasMore(false);
        return;
      }
      
      if (result.posts.length > 0) {
        setPosts(prevPosts => [...prevPosts, ...result.posts]);
        setPage(prevPage => prevPage + 1);
        setHasMore(result.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (error: unknown) {
      console.error('Unexpected error loading more posts:', error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, hasMore, isLoadingMore]);

  // Trigger loadMorePosts when the bottom element comes into view
  useEffect(() => {
    if (inView && hasMore && !isLoadingMore) {
      loadMorePosts();
    }
  }, [inView, hasMore, isLoadingMore, loadMorePosts]);

  // Supabase Realtime subscription for ticker_insights updates
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel('ticker_insights_updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ticker_insights'
      }, (payload: { new: { ticker: string; ai_score: number; ai_signal: string; ai_risk: string } }) => {
        const updatedRow = payload.new;
        
        setInsights(prev => {
          const newMap = new Map(prev);
          newMap.set(updatedRow.ticker, {
            ai_score: updatedRow.ai_score,
            ai_signal: updatedRow.ai_signal,
            ai_risk: updatedRow.ai_risk
          });
          return newMap;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDeletePost = (postId: number) => {
    // Optimistically remove the post from the UI
    setPosts(prevPosts => {
      return prevPosts.filter(p => p.id !== postId);
    });
  };

  // Filter and sort posts based on active filter
  const filteredPosts = useMemo(() => {
    let postsToFilter = [...posts];

    switch (activeFilter) {
      case 'trending':
        // Sort by engagement (likes + comments)
        postsToFilter.sort((a, b) => {
          const engagementA = (a.reactions?.length || 0) + (a.comments?.length || 0);
          const engagementB = (b.reactions?.length || 0) + (b.comments?.length || 0);
          return engagementB - engagementA;
        });
        break;

      case 'bullish':
        postsToFilter = postsToFilter.filter(p => p.user_sentiment_label === 'Bullish');
        break;

      case 'bearish':
        postsToFilter = postsToFilter.filter(p => p.user_sentiment_label === 'Bearish');
        break;

      case 'high-risk':
        // Use live insights if available, otherwise fall back to post data
        postsToFilter = postsToFilter.filter(p => {
          const liveData = insights.get(p.ticker);
          const risk = liveData?.ai_risk || p.ai_risk;
          return risk === 'High' || risk === 'Extreme';
        });
        break;

      default:
        // 'all' - no filtering, keep chronological order
        break;
    }

    return postsToFilter;
  }, [posts, activeFilter, insights]);

  const filterButtons: { id: FilterType; label: string; icon?: React.ReactNode }[] = [
    { id: 'all', label: 'All' },
    { id: 'trending', label: 'Trending', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'bullish', label: 'Bullish', icon: <ChevronUp className="w-4 h-4" /> },
    { id: 'bearish', label: 'Bearish', icon: <ChevronDown className="w-4 h-4" /> },
    { id: 'high-risk', label: 'High Risk', icon: <AlertTriangle className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Pills Container */}
      {/* - flex-nowrap: Forces single row
         - overflow-x-auto: Enables horizontal scrolling
         - whitespace-nowrap: Prevents content inside from wrapping 
      */}
      <div className="flex flex-nowrap overflow-x-auto whitespace-nowrap gap-2 p-4 bg-card rounded-xl border border-border">
        {filterButtons.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`
              /* Default/Desktop Styles */
              md:px-4 md:py-2 md:text-sm 
              
              /* Mobile Styles */
              px-3 py-1 text-xs 
              
              /* Structural Styles */
              flex-shrink-0 /* Prevents button from squishing in scroll view */
              flex-grow-0 
              rounded-full font-medium transition-all flex items-center gap-2
              
              ${activeFilter === filter.id
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }
            `}
          >
            {/* Conditional Icon: Hidden on mobile (hidden), Visible on desktop (md:flex) */}
            <span className="hidden md:flex items-center">
              {filter.icon}
            </span>
            
            <span>{filter.label}</span>
            {/* Number badge removed completely as requested */}
          </button>
        ))}
      </div>

      {/* Posts Feed */}
      <div className="space-y-6">
        {isLoading ? (
          <FeedSkeleton count={5} />
        ) : filteredPosts.length > 0 ? (
          <>
            {filteredPosts.map((post) => {
              const initialLikes = post.reactions?.length || 0;
              const initialUserHasLiked = viewerId 
                ? post.reactions?.some(r => r.user_id === viewerId) 
                : false;
              const initialCommentCount = post.comments?.length || 0;
              
              // Get live AI insight for this ticker
              const liveInsight = insights.get(post.ticker);

              return (
                <PostCard
                  key={post.id}
                  post={post}
                  initialLikes={initialLikes}
                  initialUserHasLiked={initialUserHasLiked}
                  initialCommentCount={initialCommentCount}
                  liveInsight={liveInsight}
                  onDelete={() => handleDeletePost(post.id)}
                />
              );
            })}
            
            {/* Infinite scroll trigger */}
            {hasMore && (
              <div ref={ref} className="flex justify-center py-8">
                {isLoadingMore ? (
                  <FeedSkeleton count={3} />
                ) : (
                  <div className="text-muted-foreground text-sm">
                    Loading more posts...
                  </div>
                )}
              </div>
            )}
            
            {!hasMore && filteredPosts.length > 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                You&apos;ve reached the end of the feed
              </div>
            )}
          </>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <p className="text-muted-foreground text-lg">
              No posts found for {activeFilter === 'all' ? 'this feed' : `${activeFilter}`} filter
            </p>
            <p className="text-muted-foreground/70 text-sm mt-2">
              Try a different filter or create a new post
            </p>
          </div>
        )}
      </div>
    </div>
  );
}