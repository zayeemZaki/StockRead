'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { TickerSearch } from './ticker-search';

export function CreatePost() {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in to post!');
      router.push('/login');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          ticker: ticker.toUpperCase(),
          content: content
        });

      if (error) throw error;
      
      toast.success('Signal posted successfully!');
      setOpen(false);
      setTicker('');
      setContent('');
      window.location.reload();
    } catch (err: any) {
      toast.error('Error posting: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFakeInputClick = () => {
    if (!user) {
      toast.error('Please log in to post!');
      router.push('/login');
      return;
    }
    setOpen(true);
  };

  return (
    <div className="mb-8">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            onClick={handleFakeInputClick}
            className="w-full bg-muted border border-border rounded-full px-4 py-3 text-muted-foreground cursor-pointer hover:bg-muted/80 transition flex items-center gap-3"
          >
            <Pencil className="w-5 h-5" />
            <span>Drop a signal...</span>
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Drop a Signal</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Share your market thesis with the community
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <TickerSearch onSelect={(symbol: string) => setTicker(symbol)} />
            </div>
            <div>
              <textarea
                placeholder="What is your thesis? (Bullish/Bearish because...)"
                className="w-full bg-muted border border-input rounded-lg p-3 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring outline-none h-32 resize-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit" 
              disabled={loading || !ticker}
              className="w-full"
            >
              {loading ? 'Posting...' : 'Share Signal'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
