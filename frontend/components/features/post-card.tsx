'use client';

import Link from 'next/link';
import { Post } from '@/types';
import { POPULAR_STOCKS } from '@/lib/tickers';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StockLogo } from '@/components/ui/stock-logo';
import { PostActions } from './post-actions';
import { Bot, Trash2, MoreVertical } from 'lucide-react';
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

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.id !== post.user_id) {
        setIsDeleting(false);
        setShowDeleteDialog(false);
        return;
      }

      await supabase.from('comments').delete().eq('post_id', post.id);
      await supabase.from('reactions').delete().eq('post_id', post.id);
      
      const { error } = await supabase
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

      setIsDeleted(true);
      setShowDeleteDialog(false);
      setIsDeleting(false);
      
      if (onDelete) {
        onDelete();
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, [supabase]);

  const isOwner = currentUser && currentUser.id === post.user_id;

  const getInitials = (username: string) => {
    return username
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const slugifyUsername = (username: string) => {
    return username
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  const getUserBadgeColor = (sentiment: string) => {
    if (sentiment === 'Bullish') return 'bg-bullish hover:bg-bullish/90 text-bullish-foreground border-bullish';
    if (sentiment === 'Bearish') return 'bg-bearish hover:bg-bearish/90 text-bearish-foreground border-bearish';
    return 'bg-muted hover:bg-muted/80 text-muted-foreground';
  };

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

  // Only show financial data section when AI analysis has been completed
  // Check if AI has analyzed (has ai_score or ai_summary)
  const hasFinancialData = !!(post.ai_score !== null && post.ai_score !== undefined) || !!(post.ai_summary && post.ai_summary.trim() !== '');
  const hasPriceHistory = post.price_history && Array.isArray(post.price_history) && post.price_history.length > 0;
  
  const getChartColor = () => {
    if (!post.price_history || post.price_history.length < 2) return 'hsl(var(--bullish))';
    const first = post.price_history[0];
    const last = post.price_history[post.price_history.length - 1];
    return last >= first ? 'hsl(var(--bullish))' : 'hsl(var(--bearish))';
  };

  const chartData = post.price_history?.map((price, index) => ({
    index,
    price
  })) || [];

  const formatMetricValue = (value: unknown) => {
    if (value === null || value === undefined || value === 'N/A') return 'N/A';
    if (typeof value === 'number') return value.toFixed(2);
    return value.toString();
  };

  if (isDeleted) {
    return null;
  }

  return (
    <Card className="bg-card border-border shadow-sm overflow-hidden p-2 sm:p-3 mb-3 last:mb-0">
      
      {/* ZONE 1: HEADER - Single Row Layout for Mobile */}
      <div className="pb-2">
        {/* Main Row: User Info (Left) --- Ticker Info (Right) */}
        <div className="flex items-start justify-between mb-2">
          
          {/* Left: Avatar + Name + Sentiment */}
          <Link 
            href={`/profile/${slugifyUsername(post.profiles?.username || '')}`}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity max-w-[65%]"
          >
            <Avatar className="w-8 h-8 border-2 border-border flex-shrink-0">
              <AvatarImage src={post.profiles?.avatar_url ?? undefined} alt={post.profiles?.username} />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {getInitials(post.profiles?.username || 'U')}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground hover:underline truncate">
                  {post.profiles?.username || 'Unknown'}
                </span>
                
                {/* User Sentiment - Next to Name */}
                {post.user_sentiment_label && (
                  <Badge 
                    variant="outline" 
                    className={`${getUserBadgeColor(post.user_sentiment_label)} text-[10px] h-5 px-1.5 flex-shrink-0`}
                  >
                    {post.user_sentiment_label}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate">
                {new Date(post.created_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric'
                })}
              </span>
            </div>
          </Link>

          {/* Right: Ticker + Logo + Menu */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link 
              href={`/ticker/${post.ticker}`}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {/* REVERTED: Standard Logo component without extra wrapper or background */}
              <StockLogo ticker={post.ticker} domain={stockInfo?.domain} size="md" />
              <span className="text-sm font-bold text-primary">{post.ticker}</span>
            </Link>
            
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                    disabled={isDeleting}
                  >
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
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

        {/* User's Post Content */}
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
          {post.content}
        </p>
      </div>

      {/* ZONE 2: MARKET CONTEXT - Financial Data */}
      {hasFinancialData && (
        <div className="pb-3">
          <div className="bg-muted/30 border border-border rounded-lg p-2">
            <div className="flex flex-col sm:flex-row items-start gap-3">
              
              {/* Sparkline Chart - Only show if price history exists */}
              {hasPriceHistory && (
                <div className="w-full sm:w-auto sm:flex-shrink-0 flex sm:block justify-between items-center border-b sm:border-b-0 border-border pb-2 sm:pb-0 mb-2 sm:mb-0">
                  <div className="text-xs text-muted-foreground font-medium sm:mb-1">7-Day Trend</div>
                  <ResponsiveContainer width={120} height={40}>
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
              )}

              {/* Data Grid: 2 Cols on Mobile, 4 Cols on Desktop */}
              <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-2">
                
                {/* Market Cap */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mkt Cap</div>
                  <div className="text-xs sm:text-sm font-mono font-medium text-foreground truncate">
                    {formatMetricValue(post.raw_market_data?.market_cap)}
                  </div>
                </div>

                {/* P/E Ratio */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">P/E Ratio</div>
                  <div className="text-xs sm:text-sm font-mono font-medium text-foreground">
                    {formatMetricValue(post.raw_market_data?.pe_ratio)}
                  </div>
                </div>

                {/* Beta */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Beta</div>
                  <div className="text-xs sm:text-sm font-mono font-medium text-foreground">
                    {formatMetricValue(post.raw_market_data?.beta)}
                  </div>
                </div>

                {/* 52-Week High */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">52W High</div>
                  <div className="text-xs sm:text-sm font-mono font-medium text-foreground">
                    ${formatMetricValue(post.raw_market_data?.fiftyTwoWeekHigh)}
                  </div>
                </div>

                {/* Analyst Target */}
                {(() => {
                  const targetPrice = post.target_price;
                  const currentPrice = post.raw_market_data?.price 
                    ? (typeof post.raw_market_data.price === 'string' 
                        ? parseFloat(post.raw_market_data.price) 
                        : post.raw_market_data.price)
                    : null;
                  
                  // Validate both prices are valid numbers
                  const isValidTarget = targetPrice !== null && targetPrice !== undefined && !isNaN(targetPrice) && targetPrice > 0;
                  const isValidCurrent = currentPrice !== null && currentPrice !== undefined && !isNaN(currentPrice) && currentPrice > 0;
                  
                  if (isValidTarget && isValidCurrent) {
                    return (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</div>
                        <div className={`text-xs sm:text-sm font-mono font-semibold ${
                          targetPrice > currentPrice 
                            ? 'text-bullish' 
                            : 'text-bearish'
                        }`}>
                          ${targetPrice.toFixed(2)}
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</div>
                      <div className="text-xs sm:text-sm font-mono font-medium text-muted-foreground">-</div>
                    </div>
                  );
                })()}

                {/* Consensus Rating */}
                <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Consensus</div>
                    {(() => {
                      // Check both analyst_rating (denormalized) and raw_market_data.recommendationKey (fallback)
                      const consensus = post.analyst_rating || post.raw_market_data?.recommendationKey;
                      if (consensus) {
                        const consensusLower = consensus.toLowerCase();
                        return (
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] px-1.5 py-0 h-5 font-semibold mt-0.5 ${
                              consensusLower.includes('buy') 
                                ? 'bg-bullish/10 text-bullish border-bullish/30' 
                                : consensusLower.includes('sell')
                                ? 'bg-bearish/10 text-bearish border-bearish/30'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {consensus}
                          </Badge>
                        );
                      }
                      return (
                        <div className="text-xs sm:text-sm font-mono font-medium text-muted-foreground">-</div>
                      );
                    })()}
                </div>

                {/* Short Interest */}
                <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Short</div>
                    {post.short_float !== null && post.short_float !== undefined ? (
                      <div className={`text-xs sm:text-sm font-mono font-medium flex items-center gap-1 ${
                        post.short_float > 0.20 ? 'text-warning' : 'text-foreground'
                      }`}>
                        {(post.short_float * 100).toFixed(1)}%
                        {post.short_float > 0.20 && <span className="text-xs">🔥</span>}
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm font-mono font-medium text-muted-foreground">-</div>
                    )}
                </div>

                {/* Insider Holdings */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Insiders</div>
                  <div className="text-xs sm:text-sm font-mono font-medium text-foreground">
                    {post.insider_held !== null && post.insider_held !== undefined 
                      ? `${(post.insider_held * 100).toFixed(1)}%`
                      : '-'
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ZONE 3: MARKET REALITY CHECK */}
      {post.ai_summary && (
        <div className="bg-muted/40 border-t border-border flex flex-col gap-2 py-2">
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            
            <div className="flex items-center gap-2 mb-1 sm:mb-0">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-wide">
                Market Reality Check
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Use liveInsight if available, otherwise fall back to post data */}
              {(liveInsight?.ai_score ?? post.ai_score) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">Score:</span>
                  <Badge 
                    className={`${getAIScoreBadge(liveInsight?.ai_score ?? post.ai_score ?? 50)} text-[10px] px-1.5 h-5 font-bold`}
                  >
                    {(liveInsight?.ai_score ?? post.ai_score ?? 0)}/100
                  </Badge>
                </div>
              )}
              
              {liveInsight?.ai_signal && (
                <Badge className={`${getSignalBadge(liveInsight.ai_signal)} text-[10px] px-1.5 h-5 font-bold uppercase`}>
                  {liveInsight.ai_signal}
                </Badge>
              )}
              
              {(liveInsight?.ai_risk ?? post.ai_risk) && (
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="text-muted-foreground text-[10px] hidden sm:inline">|</span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">Risk:</span>
                  <Badge variant="outline" className={`${getRiskBadge(liveInsight?.ai_risk ?? post.ai_risk ?? 'Medium')} text-[10px] px-1.5 h-5`}>
                    {liveInsight?.ai_risk ?? post.ai_risk}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line pl-0.5">
            {post.ai_summary.replace(/🤖 AI (FACT CHECK|Context Check):/gi, "").trim()}
          </p>
        </div>
      )}

      {/* ACTIONS */}
      <div className="border-t border-border pt-2">
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