'use server';

import { createClient } from '@/lib/supabase-server';
import { Post } from '@/types';

export async function fetchMorePosts(page: number = 0, limit: number = 10, filter: string = 'all', ticker?: string): Promise<{
  posts: Post[];
  hasMore: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  
  try {
    // Calculate range for pagination
    const start = page * limit;
    const end = start + limit - 1;
    
    let query;
    let countQuery;
    
    if (filter === 'trending') {
      // Query trending_posts_24h materialized view
      query = supabase
        .from('trending_posts_24h')
        .select(`
          *,
          comments ( id ),
          reactions ( user_id )
        `)
        .order('trending_score', { ascending: false })
        .range(start, end);
      
      // Apply ticker filter if provided
      if (ticker) {
        query = query.eq('ticker', ticker);
      }
      
      countQuery = supabase
        .from('trending_posts_24h')
        .select('*', { count: 'exact', head: true });
      
      if (ticker) {
        countQuery = countQuery.eq('ticker', ticker);
      }
    } else {
      // Default query for 'all', 'bullish', etc.
      query = supabase
        .from('posts')
        .select(`
          *,
          author_username,
          author_avatar,
          comments ( id ),
          reactions ( user_id )
        `)
        .order('created_at', { ascending: false })
        .range(start, end);
      
      // Apply ticker filter if provided
      if (ticker) {
        query = query.eq('ticker', ticker);
      }
      
      countQuery = supabase
        .from('posts')
        .select('*', { count: 'exact', head: true });
      
      if (ticker) {
        countQuery = countQuery.eq('ticker', ticker);
      }
    }
    
    const { data: rawPosts, error } = await query;
    
    if (error) {
      console.error('Error fetching posts:', error);
      return {
        posts: [],
        hasMore: false,
        error: error.message
      };
    }
    
    // Transform trending posts to match Post interface
    let posts: Post[] = [];
    if (filter === 'trending' && rawPosts) {
      posts = rawPosts.map(post => ({
        ...post,
        profiles: {
          username: post.author_username || 'Unknown',
          avatar_url: post.author_avatar || null
        }
      })) as Post[];
    } else {
      posts = (rawPosts || []).map(post => ({
        ...post,
        profiles: {
          username: post.author_username || 'Unknown',
          avatar_url: post.author_avatar || null
        }
      })) as Post[];
    }
    
    // Check if there are more posts
    const { count } = await countQuery;
    const totalPosts = count || 0;
    const hasMore = end + 1 < totalPosts;
    
    return {
      posts,
      hasMore
    };
  } catch (error: unknown) {
    console.error('Unexpected error fetching posts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch posts';
    return {
      posts: [],
      hasMore: false,
      error: errorMessage
    };
  }
}

