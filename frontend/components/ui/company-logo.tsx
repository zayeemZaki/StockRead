'use client';

interface CompanyLogoProps {
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

export function CompanyLogo({ ticker, domain, size = 'xl' }: CompanyLogoProps) {
  if (!domain) return null;

  const logoUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;

  return (
    <img
      src={logoUrl}
      alt={`${ticker} logo`}
      className={`${sizeClasses[size]} rounded-2xl shadow-xl`}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}
