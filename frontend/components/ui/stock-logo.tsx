'use client';

interface StockLogoProps {
  ticker: string;
  domain?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20',
};

export function StockLogo({ ticker, domain, size = 'xl' }: StockLogoProps) {
  if (!domain) return null;

  const logoUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;

  return (
    <img
      src={logoUrl}
      alt={`${ticker} logo`}
      className={`${sizeClasses[size]} rounded-2xl bg-white p-1 shadow-xl flex-shrink-0`}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}
