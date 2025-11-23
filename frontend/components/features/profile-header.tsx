'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FollowButton } from './follow-button';
import { UserListDialog } from './user-list-dialog';
import Link from 'next/link';

interface ProfileHeaderProps {
  profile: {
    id: string;
    username: string;
    avatar_url: string;
  };
  currentUserId: string | null;
  isOwner: boolean;
  isFollowing: boolean;
  stats: {
    reputationScore: number;
    totalPosts: number;
    accuracy: number;
    followersCount: number;
    followingCount: number;
  };
}

export function ProfileHeader({
  profile,
  currentUserId,
  isOwner,
  isFollowing,
  stats,
}: ProfileHeaderProps) {
  const [followersCount, setFollowersCount] = useState(stats.followersCount);
  const [activeDialog, setActiveDialog] = useState<'followers' | 'following' | null>(null);
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFollowChange = (newIsFollowing: boolean, newCount: number) => {
    setFollowersCount(newCount);
  };

  return (
    <div className="mb-6">
      {/* Banner with gradient */}
      <div className="h-32 w-full bg-gradient-to-r from-blue-900 to-slate-900 rounded-t-lg" />
      
      {/* Profile Content */}
      <div className="bg-card border-x border-b border-border rounded-b-lg px-4 pb-4">
        <div className="flex items-start justify-between">
          {/* Avatar (overlapping banner) */}
          <div className="-mt-16 mb-3">
            <Avatar className="w-28 h-28 border-4 border-card shadow-xl">
              <AvatarImage src={profile.avatar_url} alt={profile.username} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {getInitials(profile.username)}
              </AvatarFallback>
            </Avatar>
          </div>
          
          {/* Action Button (aligned with top of profile section) */}
          <div className="mt-3">
            {isOwner ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/settings">Edit Profile</Link>
              </Button>
            ) : currentUserId ? (
              <FollowButton
                profileUserId={profile.id}
                currentUserId={currentUserId}
                initialIsFollowing={isFollowing}
                initialFollowersCount={followersCount}
                onFollowChange={handleFollowChange}
              />
            ) : null}
          </div>
        </div>

        {/* Identity Section */}
        <div className="mb-3">
          <h1 className="text-2xl font-bold">{profile.username}</h1>
          <p className="text-muted-foreground text-sm">@{profile.username.toLowerCase().replace(/\s+/g, '')}</p>
        </div>

        {/* Stats Row - Single line with dots */}
        <div className="text-sm text-foreground flex items-center gap-2 flex-wrap">
          <span>
            <strong className="font-bold">{stats.reputationScore}</strong> <span className="text-muted-foreground">Reputation</span>
          </span>
          <span className="text-muted-foreground">·</span>
          <span>
            <strong className="font-bold">{stats.totalPosts}</strong> <span className="text-muted-foreground">Posts</span>
          </span>
          <span className="text-muted-foreground">·</span>
          <span>
            <strong className="font-bold">{stats.accuracy}%</strong> <span className="text-muted-foreground">Accuracy</span>
          </span>
          <span className="text-muted-foreground">·</span>
          <button 
            onClick={() => setActiveDialog('followers')}
            className="hover:underline"
          >
            <strong className="font-bold">{followersCount}</strong> <span className="text-muted-foreground">Followers</span>
          </button>
          <span className="text-muted-foreground">·</span>
          <button 
            onClick={() => setActiveDialog('following')}
            className="hover:underline"
          >
            <strong className="font-bold">{stats.followingCount}</strong> <span className="text-muted-foreground">Following</span>
          </button>
        </div>
      </div>
      
      {/* User List Dialogs */}
      <UserListDialog
        userId={profile.id}
        type="followers"
        open={activeDialog === 'followers'}
        onOpenChange={(open) => setActiveDialog(open ? 'followers' : null)}
      />
      <UserListDialog
        userId={profile.id}
        type="following"
        open={activeDialog === 'following'}
        onOpenChange={(open) => setActiveDialog(open ? 'following' : null)}
      />
    </div>
  );
}
