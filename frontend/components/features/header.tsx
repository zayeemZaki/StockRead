import Link from 'next/link';

export function Header() {
  return (
    <div className="flex items-center justify-between mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-primary">
        Stock Read <span className="text-muted-foreground text-lg font-normal">| AI Insider</span>
      </h1>
      <Link 
        href="/login" 
        className="text-sm text-muted-foreground hover:text-foreground transition"
      >
        Account
      </Link>
    </div>
  );
}
