'use client';

import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { Comment } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface CommentSectionProps {
  postId: number;
}

// Helper function for relative time formatting
function getTimeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getInitials(username: string): string {
  return username
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function CommentSection({ postId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  interface CurrentUser {
    id: string;
    profile?: {
      username?: string;
      avatar_url?: string;
    };
  }
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [showAllComments, setShowAllComments] = useState(false);
  
  const supabase = createClient();

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .single();
      
      setCurrentUser({
        id: user.id,
        profile: profile || undefined
      });
    }
  };

  const fetchComments = async () => {
    setIsLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles(username, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedComments = (data || []).map((comment) => ({
        ...comment,
        profiles: Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles
      }));
      setComments(formattedComments);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching comments:', errorMessage);
    } finally {
      setIsLoadingComments(false);
    }
  };

  useEffect(() => {
    fetchComments();
    getCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isSubmittingComment) return;

    if (!currentUser) {
      alert('Please log in to comment');
      return;
    }

    try {
      setIsSubmittingComment(true);

      const optimisticComment: Comment = {
        id: Date.now(),
        content: commentText,
        created_at: new Date().toISOString(),
        user_id: currentUser.id,
        profiles: {
          username: currentUser.profile?.username || 'You',
          avatar_url: currentUser.profile?.avatar_url || ''
        }
      };

      setComments([...comments, optimisticComment]);
      setCommentText('');

      const { data, error } = await supabase
        .from('comments')
        .insert({
          content: commentText,
          post_id: postId,
          user_id: currentUser.id
        })
        .select('*, profiles(username, avatar_url)')
        .single();

      if (error) throw error;

      const formattedData = {
        ...data,
        profiles: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
      };
      setComments(prev => 
        prev.map(c => c.id === optimisticComment.id ? formattedData : c)
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error posting comment:', errorMessage);
      fetchComments();
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && commentText.trim()) {
      e.preventDefault();
      handleCommentSubmit(e as unknown as React.FormEvent);
    }
  };

  const displayedComments = showAllComments ? comments : comments.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Comment List */}
      {isLoadingComments ? (
        <div className="text-center text-muted-foreground py-8 text-sm">Loading comments...</div>
      ) : comments.length > 0 ? (
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {displayedComments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              {/* Avatar */}
              <Avatar className="w-9 h-9 flex-shrink-0">
                <AvatarImage src={comment.profiles.avatar_url ?? undefined} alt={comment.profiles.username} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getInitials(comment.profiles.username)}
                </AvatarFallback>
              </Avatar>

              {/* Content Block */}
              <div className="flex-1 min-w-0">
                {/* Header: Username + Time */}
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-sm text-foreground">
                    {comment.profiles.username}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {getTimeAgo(comment.created_at)}
                  </span>
                </div>

                {/* Comment Body */}
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-8 text-sm">No comments yet. Be the first!</div>
      )}

      {/* Show More Button */}
      {comments.length > 5 && !showAllComments && (
        <button
          onClick={() => setShowAllComments(true)}
          className="text-sm text-primary hover:underline font-medium"
        >
          View all {comments.length} comments
        </button>
      )}

      {/* Input Area - Fixed at Bottom */}
      <div className="border-t border-border pt-4">
        <form onSubmit={handleCommentSubmit} className="flex gap-3">
          {/* Current User Avatar */}
          {currentUser && (
            <Avatar className="w-9 h-9 flex-shrink-0">
              <AvatarImage src={currentUser.profile?.avatar_url} alt={currentUser.profile?.username} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(currentUser.profile?.username || 'U')}
              </AvatarFallback>
            </Avatar>
          )}

          {/* Input Field */}
          <Input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a reply..."
            disabled={isSubmittingComment}
            className="flex-1"
          />

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!commentText.trim() || isSubmittingComment}
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
