'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { User, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  
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

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-background text-foreground pt-24 pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground pt-24 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">Manage your account preferences and settings</p>
          </div>

          <div className="space-y-6">
            {/* Section 1: Profile Details */}
            <Card className="bg-card text-card-foreground border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  <CardTitle>Profile Details</CardTitle>
                </div>
                <CardDescription className="text-muted-foreground">
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Compact Avatar Upload - Inline with Username */}
                <div className="flex items-start gap-4 pb-4 border-b border-border">
                  <div className="flex-shrink-0">
                    <Avatar className="w-20 h-20 border-2 border-primary/30">
                      <AvatarImage src={avatarUrl || ''} alt="Profile picture" />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                        {username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 flex flex-col justify-center gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{username}</p>
                      <p className="text-sm text-muted-foreground">{email}</p>
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
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-foreground">
                    Username
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    readOnly
                    disabled
                    className="bg-muted border-border text-zinc-900 dark:text-zinc-100 disabled:opacity-100 disabled:cursor-not-allowed placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Username cannot be changed
                  </p>
                </div>

                {/* Email (Read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    readOnly
                    disabled
                    className="bg-muted border-border text-zinc-900 dark:text-zinc-100 disabled:opacity-100 disabled:cursor-not-allowed placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Contact support to change your email
                  </p>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="bg-muted border-input text-foreground placeholder:text-muted-foreground focus:border-ring"
                  />
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-foreground">
                    Bio
                  </Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    maxLength={160}
                    rows={4}
                    className="bg-muted border-input text-foreground placeholder:text-muted-foreground focus:border-ring resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {bio.length}/160 characters
                  </p>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleSaveChanges}
                    disabled={saving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                  
                  {saveSuccess && (
                    <div className="flex items-center gap-2 text-bullish animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Changes saved!</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
