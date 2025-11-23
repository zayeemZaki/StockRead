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

    // DB Write
    const { data, error: dbError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        ticker: ticker.toUpperCase(),
        content: content,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return { success: false, error: 'Failed to create post' };
    }

    // Redis Push (The Trigger)
    const redis = new Redis(process.env.REDIS_URL!);
    await redis.lpush('analysis_jobs', JSON.stringify({
      postId: data.id,
      ticker: ticker.toUpperCase()
    }));
    await redis.quit();

    return { success: true, postId: data.id };
  } catch (error) {
    console.error('Create post action error:', error);
    return { success: false, error: 'Internal server error' };
  }
}