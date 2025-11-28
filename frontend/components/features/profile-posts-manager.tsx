'use client';

import { useState, useEffect } from 'react';
import { Post } from '@/types';
import { PostCard } from './post-card';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

interface ProfilePostsManagerProps {
  initialPosts: Post[];
  viewerId: string | null;
  emptyMessage?: string;
  emptySubMessage?: string;
}

export function ProfilePostsManager({ 
  initialPosts, 
  viewerId,
  emptyMessage = "No signals posted yet",
  emptySubMessage = "Start sharing your market insights!"
}: ProfilePostsManagerProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  // Real-time subscription for post updates (AI analysis completion)
  useEffect(() => {
    const supabase = createClient();
    
    const postsUpdateChannel = supabase
      .channel('profile_posts_updates')
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
          
          // Check if AI analysis was just completed
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
                        raw_market_data?: Post['raw_market_data'];
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
          console.error('Error updating post in profile:', error);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Profile posts update subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Profile posts update subscription error');
        }
      });

    return () => {
      supabase.removeChannel(postsUpdateChannel);
    };
  }, []);

  const handleDeletePost = (postId: number) => {
    setPosts(prevPosts => prevPosts.filter(p => p.id !== postId));
  };

  if (!posts || posts.length === 0) {
    return (
      <Card className="bg-card/50 border-border">
        <CardContent className="py-12 text-center">
          <TrendingUp className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">{emptyMessage}</p>
          <p className="text-muted-foreground/70 text-sm mt-2">
            {emptySubMessage}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post: Post) => {
        const initialLikes = post.reactions?.length || 0;
        const initialUserHasLiked = Boolean(
          viewerId && post.reactions?.some(r => r.user_id === viewerId)
        );
        const initialCommentCount = post.comments?.length || 0;

        return (
          <PostCard
            key={post.id}
            post={post}
            initialLikes={initialLikes}
            initialUserHasLiked={initialUserHasLiked}
            initialCommentCount={initialCommentCount}
            onDelete={() => handleDeletePost(post.id)}
          />
        );
      })}
    </div>
  );
}
