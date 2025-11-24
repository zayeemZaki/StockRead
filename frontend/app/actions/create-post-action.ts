'use server';

import Redis from 'ioredis';
import { createClient } from '@/lib/supabase-server';
import { sanitizeTicker, sanitizeContent } from '@/lib/sanitize';

// Singleton Redis client for connection pooling
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }
  
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });
  }
  
  return redisClient;
}

export async function createPostAction(ticker: string, content: string) {
  try {
    // Sanitize inputs
    const sanitizedTicker = sanitizeTicker(ticker);
    const sanitizedContent = sanitizeContent(content);
    
    // Validate inputs
    if (!sanitizedTicker || sanitizedTicker.length === 0) {
      return { success: false, error: 'Invalid ticker symbol' };
    }
    
    if (!sanitizedContent || sanitizedContent.trim().length < 5) {
      return { success: false, error: 'Content must be at least 5 characters' };
    }
    
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Fetch user profile for denormalized data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return { success: false, error: 'Failed to fetch user profile' };
    }

    // DB Write with denormalized author data
    const { data, error: dbError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        ticker: sanitizedTicker,
        content: sanitizedContent,
        author_username: profile.username,
        author_avatar: profile.avatar_url,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return { success: false, error: 'Failed to create post' };
    }

    // Redis Push (The Trigger) - Non-blocking: post succeeds even if Redis fails
    try {
      const redis = getRedisClient();
      if (redis) {
        // Ensure connection is established
        if (redis.status !== 'ready') {
          await redis.connect();
        }
        await redis.lpush('analysis_jobs', JSON.stringify({
          postId: data.id,
          ticker: sanitizedTicker
        }));
      } else {
        console.warn('REDIS_URL not configured - AI analysis will not be triggered');
      }
    } catch (redisError) {
      // Log but don't fail the post creation
      console.error('Redis error (non-blocking):', redisError);
      // Post still succeeds, AI analysis will be triggered on next service run
    }

    return { success: true, postId: data.id };
  } catch (error) {
    console.error('Create post action error:', error);
    return { success: false, error: 'Internal server error' };
  }
}