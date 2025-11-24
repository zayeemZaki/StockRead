'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  LogOut, 
  Settings, 
  User as UserIcon, 
  Search, 
  Palette, 
  Sun, 
  Moon, 
  Monitor, 
  Pencil,
  Home,
  LineChart
} from 'lucide-react';
import { MobileMarketSheet } from '@/components/features/mobile-market-sheet';
import { CreatePost } from '@/components/features'; 

export function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ username: string; avatar_url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  
  const supabase = createClient();

  // Helper to check if we should hide the top header
  const shouldHideTopHeader = () => {
    if (!pathname) return false;
    // Hide on Market, Settings, Profile, and Ticker pages
    return pathname === '/markets' || pathname === '/settings' || pathname.startsWith('/profile') || pathname.startsWith('/ticker');
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .single();
        
        setProfile(profileData);
      }
      
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only update on sign in/out events, not on token refresh
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => setProfile(data));
        } else {
          setProfile(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const getInitials = (username: string) => {
    return username
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getProfileSlug = (username: string) => {
    return username
      .toLowerCase()
      .replace(/\s+/g, '') 
      .replace(/[^a-z0-9]/g, ''); 
  };

  const handleSearchClick = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Top Navigation Bar - Hidden on mobile for specific pages, always visible on desktop */}
      <nav className={`fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border ${shouldHideTopHeader() ? 'hidden md:block' : ''}`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
              {/* Logo */}
              <Link href="/" className="flex items-center">
                <h1 className="text-lg font-bold tracking-tight text-primary truncate md:text-2xl">
                  <span className="md:hidden">Stock Read</span>
                  <span className="hidden md:inline">Stock Read</span>
                  <span className="hidden md:inline text-muted-foreground text-sm font-normal ml-2">| AI Insider</span>
                </h1>
              </Link>

              {/* Center - Search Trigger (Desktop Only) */}
              <div className="hidden md:flex">
                <button
                  onClick={handleSearchClick}
                  className="w-64 bg-muted border border-border text-muted-foreground text-sm px-4 py-2 rounded-full flex items-center gap-2 hover:bg-muted/80 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  <span className="flex-1 text-left">Search...</span>
                  <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-muted-foreground bg-background border border-border rounded">
                    ⌘K
                  </kbd>
                </button>
              </div>

              {/* Right Side - Actions */}
              <div className="flex items-center gap-2">
                
                {/* MOBILE ONLY: Pencil (New Signal) and Search */}
                <div className="flex items-center gap-1 md:hidden">
                  <CreatePost 
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                      >
                        <Pencil className="w-5 h-5" />
                        <span className="sr-only">New Signal</span>
                      </Button>
                    }
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSearchClick}
                  >
                    <Search className="w-5 h-5" />
                    <span className="sr-only">Search</span>
                  </Button>
                </div>

                {/* DESKTOP Actions */}
                <div className="hidden md:flex items-center gap-4">
                  <MobileMarketSheet />
                  {loading ? (
                    <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
                  ) : user && profile ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full">
                          <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                            <AvatarImage 
                              src={profile.avatar_url} 
                              alt={profile.username}
                            />
                            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                              {getInitials(profile.username)}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 bg-popover text-popover-foreground border-border">
                        <DropdownMenuLabel className="font-normal">
                          <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">{profile.username}</p>
                            <p className="text-xs leading-none text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/profile/${getProfileSlug(profile.username)}`} className="cursor-pointer w-full flex items-center">
                            <UserIcon className="mr-2 h-4 w-4" />
                            <span>My Profile</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/settings" className="cursor-pointer w-full flex items-center">
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Settings</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Palette className="mr-2 h-4 w-4" />
                            <span>Theme</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => setTheme('light')}>
                              <Sun className="mr-2 h-4 w-4" />
                              <span>Light</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme('dark')}>
                              <Moon className="mr-2 h-4 w-4" />
                              <span>Dark</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme('system')}>
                              <Monitor className="mr-2 h-4 w-4" />
                              <span>System</span>
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={handleSignOut}
                          className="cursor-pointer text-destructive focus:text-destructive"
                          variant="destructive"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Log Out</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button asChild variant="default" size="sm">
                      <Link href="/login">Log In</Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
      </nav>

      {/* BOTTOM TAB BAR (Mobile Only) - Always Visible */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border h-16 pb-safe safe-area-inset-bottom">
        <div className="grid grid-cols-4 h-full items-center">
          
          {/* Home Tab */}
          <Link 
            href="/" 
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${isActive('/') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>

          {/* Market Tab */}
          <Link 
            href="/markets"
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${isActive('/markets') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
          >
            <LineChart className="w-5 h-5" />
            <span className="text-[10px] font-medium">Market</span>
          </Link>

          {/* Settings Tab */}
          <Link 
            href="/settings" 
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${isActive('/settings') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-medium">Settings</span>
          </Link>

          {/* Profile Tab */}
          <Link 
            href={profile ? `/profile/${getProfileSlug(profile.username)}` : '/login'} 
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${profile && isActive(`/profile/${getProfileSlug(profile.username)}`) ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </Link>

        </div>
      </div>
    </>
  );
}