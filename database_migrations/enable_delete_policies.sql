-- Enable RLS delete policies for posts, comments, and reactions
-- This allows users to delete their own content

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON reactions;

-- Posts: Users can delete their own posts
CREATE POLICY "Users can delete their own posts"
ON posts
FOR DELETE
USING (auth.uid() = user_id);

-- Comments: Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
ON comments
FOR DELETE
USING (auth.uid() = user_id);

-- Reactions: Users can delete their own reactions
CREATE POLICY "Users can delete their own reactions"
ON reactions
FOR DELETE
USING (auth.uid() = user_id);

-- Additional: Allow post owners to delete comments on their posts
DROP POLICY IF EXISTS "Post owners can delete comments on their posts" ON comments;
CREATE POLICY "Post owners can delete comments on their posts"
ON comments
FOR DELETE
USING (
  auth.uid() IN (
    SELECT user_id FROM posts WHERE id = post_id
  )
);

-- Additional: Allow post owners to delete reactions on their posts
DROP POLICY IF EXISTS "Post owners can delete reactions on their posts" ON reactions;
CREATE POLICY "Post owners can delete reactions on their posts"
ON reactions
FOR DELETE
USING (
  auth.uid() IN (
    SELECT user_id FROM posts WHERE id = post_id
  )
);
