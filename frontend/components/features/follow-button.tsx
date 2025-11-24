'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase-client';
import { UserPlus, UserMinus } from 'lucide-react';

interface FollowButtonProps {
  profileUserId: string;
  currentUserId: string;
  initialIsFollowing: boolean;
  initialFollowersCount: number;
  onFollowChange?: (isFollowing: boolean, newCount: number) => void;
}

export function FollowButton({
  profileUserId,
  currentUserId,
  initialIsFollowing,
  initialFollowersCount,
  onFollowChange,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [isLoading, setIsLoading] = useState(false);
  
  const supabase = createClient();

  const handleFollowToggle = async () => {
    // Optimistic UI update
    const newIsFollowing = !isFollowing;
    const newCount = newIsFollowing ? followersCount + 1 : followersCount - 1;
    
    setIsFollowing(newIsFollowing);
    setFollowersCount(newCount);
    onFollowChange?.(newIsFollowing, newCount);
    
    setIsLoading(true);

    try {
      if (newIsFollowing) {
        // Follow: Insert into follows table
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            following_id: profileUserId,
          });

        if (error) {
          console.error('Follow error:', error);
          throw error;
        }
      } else {
        // Unfollow: Delete from follows table
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profileUserId);

        if (error) {
          console.error('Unfollow error:', error);
          throw error;
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('🚨 Error toggling follow:', errorMessage, error);
      
      // Revert optimistic update on error
      setIsFollowing(!newIsFollowing);
      setFollowersCount(followersCount);
      onFollowChange?.(!newIsFollowing, followersCount);
      
      // Show user-friendly error
      alert(`Failed to ${newIsFollowing ? 'follow' : 'unfollow'}: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleFollowToggle}
      disabled={isLoading}
      variant={isFollowing ? 'outline' : 'default'}
      className={isFollowing ? '' : ''}
    >
      {isFollowing ? (
        <>
          <UserMinus className="w-4 h-4" />
          Unfollow
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4" />
          Follow
        </>
      )}
    </Button>
  );
}
