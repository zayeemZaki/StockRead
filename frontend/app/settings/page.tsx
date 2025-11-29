'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase-client';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { User, Loader2, CheckCircle2, Sun, Moon, Mail, LogOut, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // User state
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Prevent hydration mismatch by only rendering theme-dependent UI after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          router.push('/login');
          return;
        }

        setUserId(user.id);
        setEmail(user.email || '');

        // Fetch profile data
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('username, full_name, bio, avatar_url')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        } else if (profile) {
          setUsername(profile.username || '');
          setFullName(profile.full_name || '');
          setBio(profile.bio || '');
          setAvatarUrl(profile.avatar_url || null);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleAvatarUpload = async (newUrl: string) => {
    if (!userId) return;

    try {
      // Update avatar URL in state immediately
      setAvatarUrl(newUrl);

      // Save to database
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: newUrl })
        .eq('id', userId);

      if (error) {
        console.error('Error saving avatar:', error.message);
        toast.error('Failed to save avatar');
      } else {
        toast.success('Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast.error('An error occurred while updating avatar');
    }
  };

  const handleSaveChanges = async () => {
    if (!userId) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          bio: bio.slice(0, 160),
        })
        .eq('id', userId);

      if (error) {
        alert('Error saving changes: ' + error.message);
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleRestartTutorial = () => {
    localStorage.removeItem('stockread_tutorial_completed');
    toast.success('Tutorial will appear on your next page visit');
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-background text-foreground pt-0 md:pt-16 pb-24 md:pb-8 px-4 sm:px-6 lg:px-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="pt-4 md:pt-6 mb-6 md:mb-8">
              <div className="flex items-start justify-between mb-1 md:mb-2">
                <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
                {/* Mobile Theme Toggle - Top Right */}
                {mounted && (
                  <div className="md:hidden flex items-center gap-1 bg-muted rounded-full p-0.5">
                    <Button
                      variant={theme === 'light' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 w-7 rounded-full p-0"
                      onClick={() => setTheme('light')}
                    >
                      <Sun className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={theme === 'dark' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 w-7 rounded-full p-0"
                      onClick={() => setTheme('dark')}
                    >
                      <Moon className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-sm md:text-base text-muted-foreground">Manage your account preferences and settings</p>
            </div>
            <div className="flex items-center justify-center pt-12">
              <Loader2 className="w-6 md:w-8 h-6 md:h-8 animate-spin text-primary" />
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground pt-0 md:pt-16 pb-24 md:pb-8 px-4 sm:px-6 lg:px-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Page Header with Theme Toggle */}
          <div className="pt-4 md:pt-6 mb-6 md:mb-8">
            <div className="flex items-start justify-between mb-1 md:mb-2">
              <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
              {/* Mobile Theme Toggle - Top Right */}
              {mounted && (
                <div className="md:hidden flex items-center gap-1 bg-muted rounded-full p-0.5">
                  <Button
                    variant={theme === 'light' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 w-7 rounded-full p-0"
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 w-7 rounded-full p-0"
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-sm md:text-base text-muted-foreground">Manage your account preferences and settings</p>
          </div>

          <div className="space-y-6">
            {/* Section 1: Profile Details */}
            <Card className="bg-card text-card-foreground border-border">
              <CardHeader className="pb-3 md:pb-6">
                <div className="flex items-center gap-2">
                  <User className="w-4 md:w-5 h-4 md:h-5 text-primary" />
                  <CardTitle className="text-base md:text-lg">Profile Details</CardTitle>
                </div>
                <CardDescription className="text-xs md:text-sm text-muted-foreground">
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4">
                {/* Compact Avatar Upload - Inline with Username */}
                <div className="flex items-start gap-3 md:gap-4 pb-3 md:pb-4 border-b border-border">
                  <div className="flex-shrink-0">
                    <Avatar className="w-16 md:w-20 h-16 md:h-20 border-2 border-primary/30">
                      <AvatarImage src={avatarUrl || ''} alt="Profile picture" />
                      <AvatarFallback className="bg-primary text-primary-foreground text-lg md:text-xl font-bold">
                        {username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 flex flex-col justify-center gap-1.5 md:gap-2">
                    <div>
                      <p className="text-sm md:text-base font-semibold text-foreground">{username}</p>
                      <p className="text-xs md:text-sm text-muted-foreground">{email}</p>
                    </div>
                    <AvatarUpload
                      uid={userId || ''}
                      url={avatarUrl}
                      onUpload={handleAvatarUpload}
                      compact
                    />
                  </div>
                </div>

                {/* Username (Read-only) */}
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="username" className="text-xs md:text-sm text-foreground">
                    Username
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    readOnly
                    disabled
                    className="bg-muted border-border text-foreground disabled:opacity-100 disabled:cursor-not-allowed placeholder:text-muted-foreground text-sm md:text-base h-9 md:h-10"
                  />
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    Username cannot be changed
                  </p>
                </div>

                {/* Email (Read-only) */}
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="email" className="text-xs md:text-sm text-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    readOnly
                    disabled
                    className="bg-muted border-border text-foreground disabled:opacity-100 disabled:cursor-not-allowed placeholder:text-muted-foreground text-sm md:text-base h-9 md:h-10"
                  />
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    Contact support to change your email
                  </p>
                </div>

                {/* Full Name */}
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="fullName" className="text-xs md:text-sm text-foreground">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="bg-muted border-input text-foreground placeholder:text-muted-foreground focus:border-ring text-sm md:text-base h-9 md:h-10"
                  />
                </div>

                {/* Bio */}
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="bio" className="text-xs md:text-sm text-foreground">
                    Bio
                  </Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    maxLength={160}
                    rows={3}
                    className="bg-muted border-input text-foreground placeholder:text-muted-foreground focus:border-ring resize-none text-sm md:text-base"
                  />
                  <p className="text-[10px] md:text-xs text-muted-foreground text-right">
                    {bio.length}/160 characters
                  </p>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-2 md:gap-3 pt-1 md:pt-2">
                  <Button
                    onClick={handleSaveChanges}
                    disabled={saving}
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs md:text-sm h-8 md:h-9"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-3 md:w-4 h-3 md:h-4 mr-1.5 md:mr-2 animate-spin" />
                        <span className="text-xs md:text-sm">Saving...</span>
                      </>
                    ) : (
                      <span className="text-xs md:text-sm">Save Changes</span>
                    )}
                  </Button>
                  
                  {saveSuccess && (
                    <div className="flex items-center gap-1.5 md:gap-2 text-bullish animate-in fade-in">
                      <CheckCircle2 className="w-3 md:w-4 h-3 md:h-4" />
                      <span className="text-xs md:text-sm font-medium">Changes saved!</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Support & Account Section - Mobile Only */}
            <div className="md:hidden space-y-4">
              <Card className="bg-card text-card-foreground border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-5 text-primary" />
                    <CardTitle className="text-base">Support</CardTitle>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground">
                    Need help or have questions?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/support">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Contact Support</span>
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="bg-card text-card-foreground border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Account</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Manage your account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-2"
                    onClick={handleRestartTutorial}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Restart Tutorial</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
