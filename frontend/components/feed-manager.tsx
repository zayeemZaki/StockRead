'use client';

import { useState, useMemo, useEffect } from 'react';
import { Post } from '@/types';
import { PostCard } from '@/components/features';
import { FeedSkeleton } from '@/components/ui';
import { TrendingUp, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';

type FilterType = 'all' | 'trending' | 'bullish' | 'bearish' | 'high-risk';

interface FeedManagerProps {
  initialPosts: Post[];
  viewerId: string | null;
  followingIds?: string[];
  isLoading?: boolean;
  liveInsightsMap?: Record<string, { ai_score: number; ai_signal: string; ai_risk: string }>;
}

export function FeedManager({ initialPosts, viewerId, followingIds = [], isLoading = false, liveInsightsMap }: FeedManagerProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  
  console.log('FeedManager: liveInsightsMap received:', liveInsightsMap ? Object.keys(liveInsightsMap).length : 0, 'keys');
  console.log('FeedManager: AAPL in map?', liveInsightsMap?.['AAPL']);

  // Update posts when initialPosts changes
  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  const handleDeletePost = (postId: number) => {
    console.log('Deleting post:', postId);
    // Optimistically remove the post from the UI
    setPosts(prevPosts => {
      const newPosts = prevPosts.filter(p => p.id !== postId);
      console.log('Posts after delete:', newPosts.length, 'from', prevPosts.length);
      return newPosts;
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
          const liveData = liveInsightsMap?.[p.ticker];
          const risk = liveData?.ai_risk || p.ai_risk;
          return risk === 'High' || risk === 'Extreme';
        });
        break;

      default:
        // 'all' - no filtering, keep chronological order
        break;
    }

    return postsToFilter;
  }, [posts, activeFilter, liveInsightsMap]);

  const filterButtons: { id: FilterType; label: string; icon?: React.ReactNode }[] = [
    { id: 'all', label: 'All' },
    { id: 'trending', label: 'Trending', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'bullish', label: 'Bullish', icon: <ChevronUp className="w-4 h-4" /> },
    { id: 'bearish', label: 'Bearish', icon: <ChevronDown className="w-4 h-4" /> },
    { id: 'high-risk', label: 'High Risk', icon: <AlertTriangle className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2 p-4 bg-card rounded-xl border border-border">
        {filterButtons.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2
              ${activeFilter === filter.id
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }
            `}
          >
            {filter.icon}
            <span>{filter.label}</span>
            {activeFilter === filter.id && (
              <span className="ml-1 px-2 py-0.5 bg-primary-foreground/20 rounded-full text-xs">
                {filteredPosts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Posts Feed */}
      <div className="space-y-6">
        {isLoading ? (
          <FeedSkeleton count={5} />
        ) : filteredPosts.length > 0 ? (
          filteredPosts.map((post) => {
            const initialLikes = post.reactions?.length || 0;
            const initialUserHasLiked = viewerId 
              ? post.reactions?.some(r => r.user_id === viewerId) 
              : false;
            const initialCommentCount = post.comments?.length || 0;
            
            // Get live AI insight for this ticker
            const liveInsight = liveInsightsMap?.[post.ticker];

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
          })
        ) : (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <p className="text-muted-foreground text-lg">
              No posts found for {activeFilter === 'all' ? 'this feed' : `"${activeFilter}"`} filter
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
