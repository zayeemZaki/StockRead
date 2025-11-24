'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase-client';
import { POPULAR_STOCKS } from '@/lib/tickers';
import { Search, TrendingUp, User, FileText } from 'lucide-react';

interface SearchResults {
  stocks: { ticker: string; name?: string; domain?: string; count: number; isLocal?: boolean }[];
  users: { id: string; username: string; avatar_url: string }[];
  posts: { id: number; ticker: string; content: string; created_at: string }[];
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({
    stocks: [],
    users: [],
    posts: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const supabase = createClient();

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Debounced search with 300ms delay
  useEffect(() => {
    if (!query.trim()) {
      setResults({ stocks: [], users: [], posts: [] });
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      
      try {
        const keyword = query.trim().toLowerCase();
        
        // STEP 1: LOCAL SEARCH - Filter POPULAR_STOCKS
        const localMatches = POPULAR_STOCKS.filter(stock => {
          const symbolMatch = stock.symbol.toLowerCase().includes(keyword);
          const nameMatch = stock.name.toLowerCase().includes(keyword);
          return symbolMatch || nameMatch;
        });

        // STEP 2: SERVER SEARCH - Call RPC function
        const { data: rpcData, error: rpcError } = await supabase.rpc('global_search', {
          keyword: keyword,
        });

        if (rpcError) {
          // RPC error - silently continue with local results only
        }

        // STEP 3: SAFE PARSING - Default null to empty arrays
        const serverStocks = rpcData?.stocks || [];
        const serverUsers = rpcData?.users || [];
        const serverPosts = rpcData?.posts || [];

        // STEP 4: MERGE STOCKS - Combine local + server with deduplication
        interface MergedStock {
          ticker: string;
          name: string;
          domain?: string;
          count: number;
          isLocal: boolean;
        }
        const mergedStocksMap = new Map<string, MergedStock>();

        // Add local matches first
        localMatches.forEach(stock => {
          mergedStocksMap.set(stock.symbol, {
            ticker: stock.symbol,
            name: stock.name,
            domain: stock.domain,
            count: 0,
            isLocal: true,
          });
        });

        // Merge server stocks (update count if exists, add new if not)
        interface ServerStock {
          ticker?: string;
          count?: number;
        }
        serverStocks.forEach((serverStock: ServerStock) => {
          const ticker = serverStock.ticker?.toUpperCase();
          if (!ticker) return;

          const existing = mergedStocksMap.get(ticker);
          if (existing) {
            // Update existing with server count
            mergedStocksMap.set(ticker, {
              ...existing,
              count: serverStock.count || 0,
              isLocal: false,
            });
          } else {
            // Add new server stock (not in local list)
            const localInfo = POPULAR_STOCKS.find(s => s.symbol === ticker);
            mergedStocksMap.set(ticker, {
              ticker: ticker,
              name: localInfo?.name || ticker,
              domain: localInfo?.domain,
              count: serverStock.count || 0,
              isLocal: false,
            });
          }
        });

        // Convert to array and sort (server stocks with posts first)
        const finalStocks = Array.from(mergedStocksMap.values())
          .sort((a, b) => {
            // Stocks with posts first
            if (a.count > 0 && b.count === 0) return -1;
            if (a.count === 0 && b.count > 0) return 1;
            // Then alphabetically
            return a.ticker.localeCompare(b.ticker);
          })
          .slice(0, 10);

        // STEP 5: SET RESULTS
        const finalResults = {
          stocks: finalStocks,
          users: serverUsers,
          posts: serverPosts,
        };

        setResults(finalResults);
      } catch {
        // Search error - reset results
        setResults({ stocks: [], users: [], posts: [] });
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStockLogo = (ticker: string, domain?: string) => {
    // Use provided domain or look up in POPULAR_STOCKS
    const stockDomain = domain || POPULAR_STOCKS.find((s) => s.symbol === ticker)?.domain;
    return stockDomain ? `https://icons.duckduckgo.com/ip3/${stockDomain}.ico` : null;
  };

  const truncateText = (text: string, maxLength: number = 60) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  interface StockValue {
    ticker: string;
  }
  
  interface UserValue {
    username: string;
  }
  
  interface PostValue {
    ticker: string;
  }
  
  const handleSelect = (type: 'stock' | 'user' | 'post', value: StockValue | UserValue | PostValue) => {
    setOpen(false);
    setQuery('');
    
    if (type === 'stock') {
      router.push(`/ticker/${value.ticker}`);
    } else if (type === 'user') {
      router.push(`/profile/${value.username}`);
    } else if (type === 'post') {
      // Navigate to the ticker page for the post's stock
      router.push(`/ticker/${value.ticker}`);
    }
  };

  const hasResults = results.stocks.length > 0 || results.users.length > 0 || results.posts.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Search stocks, users, or posts..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!query.trim() && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Type to search stocks, users, or posts</p>
            <p className="text-xs mt-1 text-muted-foreground/70">Press ESC to close</p>
          </div>
        )}

        {query.trim() && !isLoading && !hasResults && (
          <CommandEmpty>
            No results found for &quot;{query}&quot;
          </CommandEmpty>
        )}

        {isLoading && (
          <div className="py-6 text-center text-sm">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            Searching...
          </div>
        )}

        {/* Stocks Group */}
        {results.stocks.length > 0 && (
          <CommandGroup heading="Stocks">
            {results.stocks.map((stock) => {
              const logoUrl = getStockLogo(stock.ticker, stock.domain);
              return (
                <CommandItem
                  key={stock.ticker}
                  onSelect={() => handleSelect('stock', stock)}
                >
                  <TrendingUp className="w-5 h-5 text-bullish mr-2" />
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt={stock.ticker}
                      className="w-6 h-6 rounded bg-card p-0.5 mr-2"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{stock.ticker}</p>
                    {stock.name && <p className="text-xs text-muted-foreground">{stock.name}</p>}
                    {stock.count > 0 && (
                      <p className="text-xs text-bullish">{stock.count} post{stock.count !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Users Group */}
        {results.users.length > 0 && (
          <CommandGroup heading="Users">
            {results.users.map((user) => (
              <CommandItem
                key={user.id}
                onSelect={() => handleSelect('user', user)}
              >
                <User className="w-5 h-5 text-primary mr-2" />
                <Avatar className="w-6 h-6 mr-2">
                  <AvatarImage src={user.avatar_url} alt={user.username} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials(user.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{user.username}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Content/Posts Group */}
        {results.posts.length > 0 && (
          <CommandGroup heading="Posts">
            {results.posts.map((post) => {
              const logoUrl = getStockLogo(post.ticker);
              return (
                <CommandItem
                  key={post.id}
                  onSelect={() => handleSelect('post', post)}
                >
                  <FileText className="w-5 h-5 text-accent-foreground mr-2 mt-0.5" />
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt={post.ticker}
                      className="w-6 h-6 rounded bg-card p-0.5 mr-2 mt-0.5"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary mb-1">{post.ticker}</p>
                    <p className="text-sm line-clamp-2">
                      {truncateText(post.content)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(post.created_at).toLocaleDateString('en-US')}
                    </p>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
