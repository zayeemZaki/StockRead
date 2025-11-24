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
    <div className="mb-4 md:mb-6">
      {/* Banner with gradient */}
      <div className="h-24 md:h-32 w-full bg-gradient-to-r from-blue-900 to-slate-900 rounded-t-lg" />
      
      {/* Profile Content */}
      <div className="bg-card border-x border-b border-border rounded-b-lg px-3 md:px-4 pb-3 md:pb-4">
        <div className="flex items-start justify-between">
          {/* Avatar (overlapping banner) */}
          <div className="-mt-12 md:-mt-16 mb-2 md:mb-3">
            <Avatar className="w-20 md:w-28 h-20 md:h-28 border-3 md:border-4 border-card shadow-xl">
              <AvatarImage src={profile.avatar_url} alt={profile.username} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg md:text-2xl font-bold">
                {getInitials(profile.username)}
              </AvatarFallback>
            </Avatar>
          </div>
          
          {/* Action Button (aligned with top of profile section) */}
          <div className="mt-2 md:mt-3">
            {isOwner ? (
              <Button asChild variant="outline" size="sm" className="h-7 md:h-8 text-xs md:text-sm px-2 md:px-3">
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
        <div className="mb-2 md:mb-3">
          <h1 className="text-lg md:text-2xl font-bold">{profile.username}</h1>
          <p className="text-muted-foreground text-xs md:text-sm">{profile.username.toLowerCase().replace(/\s+/g, '')}</p>
        </div>

        {/* Stats Row - Responsive grid */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 md:gap-2 sm:gap-0 sm:items-center text-xs md:text-sm text-foreground">
          <span className="sm:inline text-xs md:text-sm">
            <strong className="font-bold">{stats.reputationScore}</strong> <span className="text-muted-foreground text-[10px] md:text-xs">Reputation</span>
          </span>
          <span className="hidden sm:inline text-muted-foreground">·</span>
          <span className="sm:inline text-xs md:text-sm">
            <strong className="font-bold">{stats.totalPosts}</strong> <span className="text-muted-foreground text-[10px] md:text-xs">Posts</span>
          </span>
          <span className="hidden sm:inline text-muted-foreground">·</span>
          <span className="sm:inline text-xs md:text-sm">
            <strong className="font-bold">{stats.accuracy}%</strong> <span className="text-muted-foreground text-[10px] md:text-xs">Accuracy</span>
          </span>
          <span className="hidden sm:inline text-muted-foreground">·</span>
          <button 
            onClick={() => setActiveDialog('followers')}
            className="hover:underline text-left sm:text-center text-xs md:text-sm"
          >
            <strong className="font-bold">{followersCount}</strong> <span className="text-muted-foreground text-[10px] md:text-xs">Followers</span>
          </button>
          <span className="hidden sm:inline text-muted-foreground">·</span>
          <button 
            onClick={() => setActiveDialog('following')}
            className="hover:underline text-left sm:text-center text-xs md:text-sm"
          >
            <strong className="font-bold">{stats.followingCount}</strong> <span className="text-muted-foreground text-[10px] md:text-xs">Following</span>
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
