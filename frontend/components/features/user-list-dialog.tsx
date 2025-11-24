'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

interface UserListDialogProps {
  userId: string;
  type: 'followers' | 'following';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string;
}

export function UserListDialog({ userId, type, open, onOpenChange }: UserListDialogProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      if (type === 'followers') {
        // Get users who follow this profile
        const { data, error } = await supabase
          .from('follows')
          .select('profiles!follower_id(id, username, avatar_url)')
          .eq('following_id', userId);

        if (error) {
          console.error('❌ Error fetching followers:', error.message, error);
          throw error;
        }

        interface FollowItem {
          profiles: {
            id: string;
            username: string;
            avatar_url: string;
          } | {
            id: string;
            username: string;
            avatar_url: string;
          }[];
        }
        
        const userProfiles = data?.map((item) => {
          const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
          if (!profile) return null;
          return {
            id: profile.id,
            username: profile.username,
            avatar_url: profile.avatar_url,
          };
        }).filter((item): item is UserProfile => item !== null) || [];

        setUsers(userProfiles);
      } else {
        // Get users that this profile follows
        const { data, error } = await supabase
          .from('follows')
          .select('profiles!following_id(id, username, avatar_url)')
          .eq('follower_id', userId);

        if (error) {
          console.error('❌ Error fetching following:', error.message, error);
          throw error;
        }

        interface FollowItem {
          profiles: {
            id: string;
            username: string;
            avatar_url: string;
          } | {
            id: string;
            username: string;
            avatar_url: string;
          }[];
        }
        
        const userProfiles = data?.map((item) => {
          const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
          if (!profile) return null;
          return {
            id: profile.id,
            username: profile.username,
            avatar_url: profile.avatar_url,
          };
        }).filter((item): item is UserProfile => item !== null) || [];

        setUsers(userProfiles);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('🚨 Error in fetchUsers:', errorMessage, error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, userId]);

  const getInitials = (username: string) => {
    return username
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const slugifyUsername = (username: string) => {
    return username
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {type === 'followers' ? 'Followers' : 'Following'}
          </DialogTitle>
          <DialogDescription>
            {type === 'followers' 
              ? 'People who follow this user' 
              : 'People this user follows'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No {type === 'followers' ? 'followers' : 'following'} yet
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {users.map((user) => (
                <Link
                  key={user.id}
                  href={`/profile/${slugifyUsername(user.username)}`}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={user.avatar_url} alt={user.username} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
