'use server';

import { createClient } from '@/lib/supabase-server';
import { Post } from '@/types';

export async function fetchMorePosts(page: number = 0, limit: number = 10): Promise<{
  posts: Post[];
  hasMore: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  
  try {
    // Calculate range for pagination
    const start = page * limit;
    const end = start + limit - 1;
    
    // Fetch posts with all joins (profiles, comments, reactions)
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles ( username, avatar_url ),
        comments ( id ),
        reactions ( user_id )
      `)
      .order('created_at', { ascending: false })
      .range(start, end);
    
    if (error) {
      console.error('Error fetching posts:', error);
      return {
        posts: [],
        hasMore: false,
        error: error.message
      };
    }
    
    // Check if there are more posts
    // Fetch one extra post to determine if there's more
    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true });
    
    const totalPosts = count || 0;
    const hasMore = end + 1 < totalPosts;
    
    return {
      posts: (posts || []) as Post[],
      hasMore
    };
  } catch (error: any) {
    console.error('Unexpected error fetching posts:', error);
    return {
      posts: [],
      hasMore: false,
      error: error?.message || 'Failed to fetch posts'
    };
  }
}

