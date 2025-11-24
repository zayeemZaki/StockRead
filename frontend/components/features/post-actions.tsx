'use client';

import { useState, useEffect } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { CommentSection } from './comment-section';

interface PostActionsProps {
  postId: number;
  initialLikes: number;
  initialUserHasLiked: boolean;
  initialCommentCount: number;
  defaultShowComments?: boolean;
}

export function PostActions({ 
  postId, 
  initialLikes, 
  initialUserHasLiked,
  initialCommentCount,
  defaultShowComments = false
}: PostActionsProps) {
  const [likes, setLikes] = useState(initialLikes);
  const [hasLiked, setHasLiked] = useState(initialUserHasLiked);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  
  const supabase = createClient();

  useEffect(() => {
    const checkUserLike = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data } = await supabase
          .from('reactions')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .eq('type', 'like')
          .maybeSingle();
        
        setHasLiked(!!data);
      }
    };
    
    checkUserLike();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const handleLikeClick = async () => {
    if (isProcessing) return;

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('Please log in');
      return;
    }

    const previousLikes = likes;
    const previousHasLiked = hasLiked;
    
    setHasLiked(!hasLiked);
    setLikes(hasLiked ? likes - 1 : likes + 1);
    setIsProcessing(true);

    try {
      if (hasLiked) {
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId)
          .eq('type', 'like');

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('reactions')
          .insert({
            user_id: user.id,
            post_id: postId,
            type: 'like'
          });

        if (error) throw error;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error updating like:', errorMessage);
      setHasLiked(previousHasLiked);
      setLikes(previousLikes);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-6 pt-4 px-6 border-t border-border">
        <button
          onClick={handleLikeClick}
          disabled={isProcessing}
          className={`flex items-center gap-2 transition-colors ${
            hasLiked 
              ? 'text-bearish' 
              : 'text-muted-foreground hover:text-bearish'
          } disabled:opacity-50`}
        >
          <Heart className={`w-5 h-5 ${hasLiked ? 'fill-bearish' : ''}`} />
          <span className="text-sm font-medium">{likes}</span>
        </button>

        <button 
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-2 transition-colors ${
            showComments 
              ? 'text-primary' 
              : 'text-muted-foreground hover:text-primary'
          }`}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{commentCount}</span>
        </button>
      </div>

      {showComments && (
        <div className="px-6 pb-4 pt-6">
          <CommentSection postId={postId} />
        </div>
      )}
    </div>
  );
}
