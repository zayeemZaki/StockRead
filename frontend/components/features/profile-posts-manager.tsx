'use client';

import { useState } from 'react';
import { Post } from '@/types';
import { PostCard } from './post-card';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

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
