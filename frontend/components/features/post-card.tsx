'use client';

import Link from 'next/link';
import { Post } from '@/types';
import { POPULAR_STOCKS } from '@/lib/tickers';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StockLogo } from '@/components/ui/stock-logo';
import { PostActions } from './post-actions';
import { Bot, TrendingUp, AlertTriangle, Trash2, MoreVertical } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase-client';
import { useState, useEffect } from 'react';

interface PostCardProps {
  post: Post;
  initialLikes: number;
  initialUserHasLiked: boolean;
  initialCommentCount: number;
  defaultShowComments?: boolean;
  onDelete?: () => void;
  liveInsight?: {
    ai_score: number;
    ai_signal: string;
    ai_risk: string;
  };
}

export function PostCard({ 
  post, 
  initialLikes, 
  initialUserHasLiked, 
  initialCommentCount,
  defaultShowComments = false,
  onDelete,
  liveInsight
}: PostCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const supabase = createClient();
  const stockInfo = POPULAR_STOCKS.find(s => s.symbol === post.ticker);
  
  // Debug logging
  console.log(`PostCard for ${post.ticker}:`, { 
    hasLiveInsight: !!liveInsight, 
    liveInsight,
    hasAiSummary: !!post.ai_summary
  });

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    console.log('Starting delete for post:', post.id);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.id !== post.user_id) {
        console.error('Unauthorized: User does not own this post');
        setIsDeleting(false);
        setShowDeleteDialog(false);
        return;
      }

      console.log('Deleting post from database...');
      
      // First, delete related records (comments and reactions)
      // Delete comments first
      console.log('Deleting comments for post:', post.id);
      const { data: deletedComments, error: commentsError } = await supabase
        .from('comments')
        .delete()
        .eq('post_id', post.id);
      
      if (commentsError) {
        console.error('Error deleting comments:', commentsError);
      } else {
        console.log('Comments deleted:', deletedComments);
      }
      
      // Delete reactions
      console.log('Deleting reactions for post:', post.id);
      const { data: deletedReactions, error: reactionsError } = await supabase
        .from('reactions')
        .delete()
        .eq('post_id', post.id);
      
      if (reactionsError) {
        console.error('Error deleting reactions:', reactionsError);
      } else {
        console.log('Reactions deleted:', deletedReactions);
      }
      
      // Now delete the post
      console.log('Deleting post itself:', post.id);
      const { data: deletedPost, error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting post:', error);
        setIsDeleting(false);
        setShowDeleteDialog(false);
        return;
      }

      console.log('Post delete response:', deletedPost);
      console.log('Post deleted successfully from database');
      
      // Verify the post is actually deleted
      const { data: verifyPost, error: verifyError } = await supabase
        .from('posts')
        .select('id')
        .eq('id', post.id)
        .maybeSingle();
      
      if (verifyError) {
        console.error('Error verifying deletion:', verifyError);
      } else {
        console.log('Verification - Post still exists?', verifyPost !== null, verifyPost);
      }
      
      // Hide the card immediately
      setIsDeleted(true);
      
      // Close dialog
      setShowDeleteDialog(false);
      setIsDeleting(false);
      
      // Then notify parent to remove from UI
      console.log('Calling onDelete callback, onDelete exists?', !!onDelete);
      if (onDelete) {
        onDelete();
      } else {
        console.warn('No onDelete callback provided!');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const [currentUser, setCurrentUser] = useState<any>(null);

  // Get current user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, [supabase]);

  const isOwner = currentUser && currentUser.id === post.user_id;

  // Helper to get initials for avatar fallback
  const getInitials = (username: string) => {
    return username
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Helper to slugify username for URL
  const slugifyUsername = (username: string) => {
    return username
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  // Determine badge colors for user sentiment
  const getUserBadgeVariant = (sentiment: string) => {
    if (sentiment === 'Bullish') return 'default';
    if (sentiment === 'Bearish') return 'destructive';
    return 'secondary';
  };

  const getUserBadgeColor = (sentiment: string) => {
    if (sentiment === 'Bullish') return 'bg-bullish hover:bg-bullish/90 text-bullish-foreground border-bullish';
    if (sentiment === 'Bearish') return 'bg-bearish hover:bg-bearish/90 text-bearish-foreground border-bearish';
    return 'bg-muted hover:bg-muted/80 text-muted-foreground';
  };

  // Determine badge colors for AI score
  const getAIScoreBadge = (score: number) => {
    if (score >= 70) return 'bg-bullish text-bullish-foreground';
    if (score >= 50) return 'bg-brand text-brand-foreground';
    if (score >= 30) return 'bg-warning text-warning-foreground';
    return 'bg-bearish text-bearish-foreground';
  };

  const getRiskBadge = (risk: string) => {
    if (risk === 'High' || risk === 'Extreme') return 'bg-bearish/20 text-bearish border-bearish/50';
    if (risk === 'Medium') return 'bg-warning/20 text-warning border-warning/50';
    return 'bg-bullish/20 text-bullish border-bullish/50';
  };

  const getSignalBadge = (signal: string) => {
    const upperSignal = signal.toUpperCase();
    if (upperSignal.includes('BUY')) return 'bg-bullish/90 text-bullish-foreground border-bullish';
    if (upperSignal.includes('SELL')) return 'bg-bearish/90 text-bearish-foreground border-bearish';
    return 'bg-warning/90 text-warning-foreground border-warning';
  };

  // Financial data helpers
  const hasFinancialData = post.price_history && post.price_history.length > 0 && post.raw_market_data;
  
  const getChartColor = () => {
    if (!post.price_history || post.price_history.length < 2) return '#10b981'; // green default
    const first = post.price_history[0];
    const last = post.price_history[post.price_history.length - 1];
    return last >= first ? '#10b981' : '#ef4444'; // green if up, red if down
  };

  const chartData = post.price_history?.map((price, index) => ({
    index,
    price
  })) || [];

  const formatMetricValue = (value: any) => {
    if (value === null || value === undefined || value === 'N/A') return 'N/A';
    if (typeof value === 'number') return value.toFixed(2);
    return value.toString();
  };

  // Don't render if deleted
  if (isDeleted) {
    return null;
  }

  return (
    <Card className="bg-card border-border shadow-xl overflow-hidden">{/* ZONE 1: USER SIGNAL - Header + Content */}
      {/* ZONE 1: USER SIGNAL - Header + Content */}
      <CardHeader className="pb-3">
        {/* User Identity + Ticker */}
        <div className="flex items-start justify-between mb-3">
          {/* Left: User Info with inline metadata */}
          <Link 
            href={`/profile/${slugifyUsername(post.profiles?.username || '')}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <Avatar className="w-10 h-10 border-2 border-border">
              <AvatarImage src={post.profiles?.avatar_url} alt={post.profiles?.username} />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {getInitials(post.profiles?.username || 'U')}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold text-foreground hover:underline mb-1">
                {post.profiles?.username || 'Unknown'}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {new Date(post.created_at).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric'
                  })}
                </span>
                {/* User Thesis Badge - Next to timestamp */}
                {post.user_sentiment_label && (
                  <>
                    <span className="text-muted-foreground text-xs">|</span>
                    <Badge 
                      variant="outline" 
                      className={`${getUserBadgeColor(post.user_sentiment_label)} text-xs h-5 px-2`}
                    >
                      {post.user_sentiment_label}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </Link>

          {/* Right: Ticker + Logo + Delete Button */}
          <div className="flex items-center gap-3">
            <Link 
              href={`/ticker/${post.ticker}`}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <StockLogo ticker={post.ticker} domain={stockInfo?.domain} size="md" />
              <span className="text-2xl font-bold text-primary">{post.ticker}</span>
            </Link>
            
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    disabled={isDeleting}
                  >
                    <MoreVertical className="w-5 h-5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={handleDeleteClick}
                    disabled={isDeleting}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* User's Post Content - MOST PROMINENT ELEMENT */}
        <p className="text-lg text-foreground leading-relaxed whitespace-pre-line">
          {post.content}
        </p>
      </CardHeader>

      {/* ZONE 2: MARKET CONTEXT - Financial Data */}
      {hasFinancialData && (
        <CardContent className="pb-4">
          <div className="bg-muted/30 border border-border rounded-lg p-3">
            <div className="flex items-start gap-4">
              {/* Left: Sparkline Chart */}
              <div className="flex-shrink-0">
                <div className="text-xs text-muted-foreground mb-1 font-medium">7-Day Trend</div>
                <ResponsiveContainer width={120} height={50}>
                  <LineChart data={chartData}>
                    <YAxis domain={['auto', 'auto']} hide />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke={getChartColor()} 
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Right: Responsive Data Grid (2 cols mobile, 4 cols desktop) */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-4">
                {/* ROW 1: VALUATION METRICS */}
                
                {/* Market Cap */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mkt Cap</div>
                  <div className="text-sm font-mono font-medium text-foreground">
                    {formatMetricValue(post.raw_market_data?.market_cap)}
                  </div>
                </div>

                {/* P/E Ratio */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">P/E Ratio</div>
                  <div className="text-sm font-mono font-medium text-foreground">
                    {formatMetricValue(post.raw_market_data?.pe_ratio)}
                  </div>
                </div>

                {/* Beta */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Beta</div>
                  <div className="text-sm font-mono font-medium text-foreground">
                    {formatMetricValue(post.raw_market_data?.beta)}
                  </div>
                </div>

                {/* 52-Week High */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">52W High</div>
                  <div className="text-sm font-mono font-medium text-foreground">
                    ${formatMetricValue(post.raw_market_data?.fiftyTwoWeekHigh)}
                  </div>
                </div>

                {/* ROW 2: SENTIMENT & GOD MODE METRICS */}

                {/* Analyst Target */}
                {post.target_price !== null && post.target_price !== undefined && post.raw_market_data?.price ? (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Analyst Target</div>
                    <div className={`text-sm font-mono font-semibold ${
                      post.target_price > post.raw_market_data.price 
                        ? 'text-bullish' 
                        : 'text-bearish'
                    }`}>
                      ${post.target_price.toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Analyst Target</div>
                    <div className="text-sm font-mono font-medium text-muted-foreground">
                      -
                    </div>
                  </div>
                )}

                {/* Consensus Rating */}
                {post.analyst_rating ? (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Consensus</div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs font-semibold mt-0.5 ${
                        post.analyst_rating.toLowerCase().includes('buy') 
                          ? 'bg-bullish/10 text-bullish border-bullish/30' 
                          : post.analyst_rating.toLowerCase().includes('sell')
                          ? 'bg-bearish/10 text-bearish border-bearish/30'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {post.analyst_rating}
                    </Badge>
                  </div>
                ) : (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Consensus</div>
                    <div className="text-sm font-mono font-medium text-muted-foreground">
                      -
                    </div>
                  </div>
                )}

                {/* Short Interest */}
                {post.short_float !== null && post.short_float !== undefined ? (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Short</div>
                    <div className={`text-sm font-mono font-medium flex items-center gap-1 ${
                      post.short_float > 0.20 ? 'text-warning' : 'text-foreground'
                    }`}>
                      {(post.short_float * 100).toFixed(1)}%
                      {post.short_float > 0.20 && <span className="text-base">🔥</span>}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Short</div>
                    <div className="text-sm font-mono font-medium text-muted-foreground">
                      -
                    </div>
                  </div>
                )}

                {/* Insider Holdings */}
                {post.insider_held !== null && post.insider_held !== undefined ? (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Insiders</div>
                    <div className="text-sm font-mono font-medium text-foreground">
                      {(post.insider_held * 100).toFixed(1)}%
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Insiders</div>
                    <div className="text-sm font-mono font-medium text-muted-foreground">
                      -
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      )}

      {/* ZONE 3: MARKET REALITY CHECK - Analysis Summary */}
      {post.ai_summary && (
        <CardFooter className="bg-muted/40 border-t border-border flex-col items-start gap-3 py-4">
          {/* Market Reality Check Header with Scores */}
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-primary uppercase tracking-wide">Market Reality Check</span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Market Score - Live data only */}
              {liveInsight?.ai_score && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Market Score:</span>
                  <Badge 
                    className={`${getAIScoreBadge(liveInsight.ai_score)} font-bold`}
                    title="Score is based on weighted P/E, VIX, and Analyst Consensus."
                  >
                    {liveInsight.ai_score}/100
                  </Badge>
                  
                  {/* Signal Badge */}
                  {liveInsight.ai_signal && (
                    <Badge className={`${getSignalBadge(liveInsight.ai_signal)} font-bold uppercase text-xs`}>
                      {liveInsight.ai_signal}
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Risk Level - Live data only */}
              {liveInsight?.ai_risk && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">|</span>
                  <span className="text-xs text-muted-foreground font-medium">Risk Level:</span>
                  <Badge variant="outline" className={getRiskBadge(liveInsight.ai_risk)}>
                    {liveInsight.ai_risk}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* AI Summary Text */}
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {post.ai_summary.replace(/🤖 AI (FACT CHECK|Context Check):/gi, "").trim()}
          </p>
        </CardFooter>
      )}

      {/* ACTIONS: Like/Comment Buttons */}
      <div className="border-t border-border">
        <PostActions 
          postId={post.id} 
          initialLikes={initialLikes} 
          initialUserHasLiked={initialUserHasLiked}
          initialCommentCount={initialCommentCount}
          defaultShowComments={defaultShowComments}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
