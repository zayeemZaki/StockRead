'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient as createBrowserClient } from '@/lib/supabase-client';
import { toast } from 'sonner';

// Initialize Supabase Browser Client
const supabase = createBrowserClient();

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // SIGN UP LOGIC
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username, // This gets passed to our SQL Trigger
            },
          },
        });
        if (error) throw error;
        toast.success('Account created successfully! You can now log in.');
        setIsSignUp(false);
      } else {
        // LOGIN LOGIC
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Welcome back! Redirecting...');
        router.push('/'); // Redirect to Home on success
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during authentication';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4 sm:p-6">
      <div className="w-full max-w-md bg-card p-6 sm:p-8 rounded-2xl border border-border shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Stock Read</h1>
          <p className="text-muted-foreground mt-2">{isSignUp ? 'Create your account' : 'Welcome back, Insider'}</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Username</label>
              <input
                type="text"
                required
                className="w-full bg-input border border-input rounded-lg p-3 focus:ring-2 focus:ring-ring outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full bg-input border border-input rounded-lg p-3 focus:ring-2 focus:ring-ring outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full bg-input border border-input rounded-lg p-3 focus:ring-2 focus:ring-ring outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-lg transition disabled:opacity-50 mt-6"
          >
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-primary hover:underline font-medium"
          >
            {isSignUp ? 'Log In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}