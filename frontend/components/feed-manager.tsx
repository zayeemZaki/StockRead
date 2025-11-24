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

  // Supabase Realtime subscription for new posts, post updates, and ticker_insights updates
  useEffect(() => {
    const supabase = createClient();
    
    // Subscribe to new posts (INSERT events)
    const postsInsertChannel = supabase
      .channel('posts_inserts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'posts'
      }, async (payload) => {
        try {
          // Fetch the new post with all relations
          const { data: newPost } = await supabase
            .from('posts')
            .select(`
              *,
              author_username,
              author_avatar,
              comments ( id ),
              reactions ( user_id )
            `)
            .eq('id', payload.new.id)
            .single();
          
          if (newPost) {
            // Add to beginning of posts list
            setPosts(prevPosts => [{
              ...newPost,
              profiles: {
                username: newPost.author_username || 'Unknown',
                avatar_url: newPost.author_avatar || null
              }
            }, ...prevPosts]);
          }
        } catch (error) {
          console.error('Error fetching new post:', error);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Posts insert subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Posts insert subscription error');
        }
      });
    
    // Subscribe to post updates (UPDATE events) - for AI analysis completion
    const postsUpdateChannel = supabase
      .channel('posts_updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'posts'
      }, async (payload) => {
        try {
          const updatedPost = payload.new as {
            id: number;
            ai_score?: number | null;
          };
          
          const oldPost = payload.old as {
            id: number;
            ai_score?: number | null;
          };
          
          // Check if AI analysis was just completed (ai_score changed from null/undefined to a value)
          const wasNull = oldPost?.ai_score === null || oldPost?.ai_score === undefined;
          const nowHasValue = updatedPost.ai_score !== null && updatedPost.ai_score !== undefined;
          const aiAnalysisJustCompleted = wasNull && nowHasValue;
          
          // If AI analysis just completed, fetch the full post with all relations
          if (aiAnalysisJustCompleted) {
            const { data: fullPost } = await supabase
              .from('posts')
              .select(`
                *,
                author_username,
                author_avatar,
                comments ( id ),
                reactions ( user_id )
              `)
              .eq('id', updatedPost.id)
              .single();
            
            if (fullPost) {
              // Update the specific post in the feed with full data
              setPosts(prevPosts => {
                const postExists = prevPosts.some(p => p.id === updatedPost.id);
                
                if (postExists) {
                  return prevPosts.map(post => {
                    if (post.id === updatedPost.id) {
                      return {
                        ...fullPost,
                        profiles: {
                          username: fullPost.author_username || post.profiles?.username || 'Unknown',
                          avatar_url: fullPost.author_avatar || post.profiles?.avatar_url || null
                        }
                      };
                    }
                    return post;
                  });
                }
                return prevPosts;
              });
            }
          } else {
            // For other updates, update fields directly from payload
            const hasAIAnalysis = updatedPost.ai_score !== null && updatedPost.ai_score !== undefined;
            
            if (hasAIAnalysis) {
              setPosts(prevPosts => {
                const postExists = prevPosts.some(p => p.id === updatedPost.id);
                
                if (postExists) {
                  return prevPosts.map(post => {
                    if (post.id === updatedPost.id) {
                      const payloadData = payload.new as {
                        ai_score?: number | null;
                        ai_summary?: string | null;
                        ai_risk?: string | null;
                        user_sentiment_label?: string | null;
                        analyst_rating?: string | null;
                        target_price?: number | null;
                        short_float?: number | null;
                        insider_held?: number | null;
                        raw_market_data?: any;
                      };
                      
                      return {
                        ...post,
                        ai_score: payloadData.ai_score ?? post.ai_score,
                        ai_summary: payloadData.ai_summary ?? post.ai_summary,
                        ai_risk: payloadData.ai_risk ?? post.ai_risk,
                        user_sentiment_label: payloadData.user_sentiment_label ?? post.user_sentiment_label,
                        analyst_rating: payloadData.analyst_rating ?? post.analyst_rating,
                        target_price: payloadData.target_price ?? post.target_price,
                        short_float: payloadData.short_float ?? post.short_float,
                        insider_held: payloadData.insider_held ?? post.insider_held,
                        raw_market_data: payloadData.raw_market_data ?? post.raw_market_data
                      };
                    }
                    return post;
                  });
                }
                return prevPosts;
              });
            }
          }
        } catch (error) {
          console.error('Error updating post:', error);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Posts update subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Posts update subscription error');
        }
      });
    
    // Subscribe to ticker insights updates
    const insightsChannel = supabase
      .channel('ticker_insights_updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ticker_insights'
      }, (payload) => {
        const updatedRow = payload.new as { ticker: string; ai_score: number; ai_signal: string; ai_risk: string };
        
        // Update insights map - this applies to all posts with matching ticker
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Ticker insights subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Ticker insights subscription error');
        }
      });

    return () => {
      supabase.removeChannel(postsInsertChannel);
      supabase.removeChannel(postsUpdateChannel);
      supabase.removeChannel(insightsChannel);
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
              const initialUserHasLiked = Boolean(
                viewerId && post.reactions?.some(r => r.user_id === viewerId)
              );
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