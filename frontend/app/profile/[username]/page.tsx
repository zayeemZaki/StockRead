import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { Navbar } from '@/components/navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileHeader, ProfilePostsManager, PostCard } from '@/components/features';
import { MessageSquare } from 'lucide-react';
import { Comment, Reaction, Post } from '@/types';

interface ProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  
  // Initialize server-side Supabase client
  const supabase = await createClient();
  
  // Get viewer ID first (current logged-in user)
  const { data: { user: viewer } } = await supabase.auth.getUser();
  
  // Decode the username in case it has URL encoding (e.g., %20 for spaces)
  const decodedUsername = decodeURIComponent(username);

  // Helper function to slugify username (same logic as navbar)
  const slugifyUsername = (name: string) => {
    return name
      .toLowerCase()
      .replace(/\s+/g, '') // Remove all spaces
      .replace(/[^a-z0-9]/g, ''); // Remove special characters
  };

  // Optimized: Try case-insensitive exact match first (database query)
  const slugifiedSearch = slugifyUsername(decodedUsername);
  
  // First attempt: Case-insensitive exact match
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .ilike('username', decodedUsername)
    .limit(1);

  let profile = profiles?.[0];

  // Second attempt: If no exact match, try to find by slugified username
  // This requires checking all profiles, but only if first query fails
  if (!profile) {
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .limit(1000); // Reasonable limit for fallback search
    
    profile = allProfiles?.find(p => 
      slugifyUsername(p.username) === slugifiedSearch
    );
  }

  if (!profile) {
    notFound();
  }

  // Check if viewer is the owner of this profile
  const isOwner = viewer?.id === profile.id;

  // Fetch followers count
  const { count: followersCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', profile.id);

  // Fetch following count
  const { count: followingCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', profile.id);

  // Check if current viewer is following this profile
  let isFollowing = false;
  if (viewer && !isOwner) {
    const { data: followData } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', viewer.id)
      .eq('following_id', profile.id)
      .single();
    
    isFollowing = !!followData;
  }

  // Fetch user's posts with reactions
  const { data: userPosts } = await supabase
    .from('posts')
    .select(`
      *,
      profiles ( username, avatar_url ),
      comments ( id ),
      reactions ( user_id )
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  // Fetch posts that this user has liked
  const { data: userLikedReactions } = await supabase
    .from('reactions')
    .select('post_id')
    .eq('user_id', profile.id)
    .eq('type', 'like');

  const likedPostIds = userLikedReactions?.map(r => r.post_id) || [];

  const { data: likedPosts } = likedPostIds.length > 0
    ? await supabase
        .from('posts')
        .select(`
          *,
          profiles ( username, avatar_url ),
          comments ( id ),
          reactions ( user_id )
        `)
        .in('id', likedPostIds)
        .order('created_at', { ascending: false })
    : { data: [] };

  // Fetch comments made by this user with full post context
  const { data: userComments } = await supabase
    .from('comments')
    .select(`
      *,
      posts (
        *,
        profiles ( username, avatar_url ),
        reactions ( user_id ),
        comments ( id )
      )
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  // Calculate stats (use reactions from userPosts directly)
  const reputationScore = userPosts?.reduce((sum, post) => sum + (post.reactions?.length || 0), 0) || 0;
  const totalPosts = userPosts?.length || 0;
  
  // Calculate accuracy based on user sentiment vs AI score
  const calculateAccuracy = () => {
    if (!userPosts || userPosts.length === 0) return 0;
    
    const gradedPosts = userPosts.filter(post => 
      post.user_sentiment_label && post.ai_score !== null
    );
    
    if (gradedPosts.length === 0) return 0;
    
    const accuratePosts = gradedPosts.filter(post => {
      const sentiment = post.user_sentiment_label;
      const score = post.ai_score;
      
      if (sentiment === 'Bullish' && score > 60) return true;
      if (sentiment === 'Bearish' && score < 40) return true;
      if (sentiment === 'Neutral' && score >= 40 && score <= 60) return true;
      
      return false;
    });
    
    return Math.round((accuratePosts.length / gradedPosts.length) * 100);
  };
  
  const accuracy = calculateAccuracy();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground pt-0 md:pt-16 pb-8 px-2 sm:px-4 lg:px-8">
        <div className="max-w-4xl mx-auto pt-6 md:pt-0">
          {/* Header Section */}
          <ProfileHeader
            profile={{
              id: profile.id,
              username: profile.username,
              avatar_url: profile.avatar_url,
            }}
            currentUserId={viewer?.id || null}
            isOwner={isOwner}
            isFollowing={isFollowing}
            stats={{
              reputationScore,
              totalPosts,
              accuracy,
              followersCount: followersCount || 0,
              followingCount: followingCount || 0,
            }}
          />

          {/* Tabs Section */}
          <Tabs defaultValue="signals" className="w-full mt-3 md:mt-4">
            <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3 bg-card border border-border h-8 md:h-10">
              <TabsTrigger value="signals" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs md:text-sm">
                {isOwner ? 'My Signals' : 'Signals'}
              </TabsTrigger>
              <TabsTrigger value="liked" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs md:text-sm">
                Likes
              </TabsTrigger>
              <TabsTrigger value="comments" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs md:text-sm">
                {isOwner ? 'My Comments' : 'Comments'}
              </TabsTrigger>
            </TabsList>

            {/* My Signals Tab */}
            <TabsContent value="signals" className="mt-3 md:mt-4">
              <ProfilePostsManager 
                initialPosts={userPosts || []}
                viewerId={viewer?.id || null}
                emptyMessage="No signals posted yet"
                emptySubMessage="Start sharing your market insights!"
              />
            </TabsContent>

            {/* Liked Posts Tab */}
            <TabsContent value="liked" className="mt-3 md:mt-4">
              <ProfilePostsManager 
                initialPosts={likedPosts || []}
                viewerId={viewer?.id || null}
                emptyMessage="No liked posts yet"
                emptySubMessage="Like posts to see them here!"
              />
            </TabsContent>

            {/* My Comments Tab */}
            <TabsContent value="comments" className="mt-3 md:mt-4">
              <div className="space-y-6">
                {userComments && userComments.length > 0 ? (
                  userComments.map((comment: Comment & { 
                    posts?: Post & {
                      reactions?: Reaction[];
                      comments?: { id: number }[];
                    }
                  }) => {
                    const post = comment.posts;
                    
                    if (!post) {
                      return null; // Skip if post was deleted
                    }

                    // Calculate initial props for the post card
                    const initialLikes = post.reactions?.length || 0;
                    const initialUserHasLiked = viewer ? post.reactions?.some((r: Reaction) => r.user_id === viewer.id) : false;
                    const initialCommentCount = post.comments?.length || 0;

                    return (
                      <div key={comment.id}>
                        <PostCard
                          post={post}
                          initialLikes={initialLikes}
                          initialUserHasLiked={initialUserHasLiked}
                          initialCommentCount={initialCommentCount}
                          defaultShowComments={true}
                        />
                      </div>
                    );
                  })
                ) : (
                  <Card className="bg-card/50 border-border">
                    <CardContent className="py-12 text-center">
                      <MessageSquare className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground text-lg">No comments yet</p>
                      <p className="text-muted-foreground/70 text-sm mt-2">
                        Start engaging with posts!
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
