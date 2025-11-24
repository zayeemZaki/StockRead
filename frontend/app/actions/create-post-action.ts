'use server';

import Redis from 'ioredis';
import { createClient } from '@/lib/supabase-server';

export async function createPostAction(ticker: string, content: string) {
  try {
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
        ticker: ticker.toUpperCase(),
        content: content,
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
      if (process.env.REDIS_URL) {
        const redis = new Redis(process.env.REDIS_URL);
        await redis.lpush('analysis_jobs', JSON.stringify({
          postId: data.id,
          ticker: ticker.toUpperCase()
        }));
        await redis.quit();
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