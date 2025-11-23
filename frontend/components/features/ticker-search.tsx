'use client';

import { useState, useRef, useEffect } from 'react';
import { POPULAR_STOCKS } from '@/lib/tickers';

interface TickerSearchProps {
  onSelect: (ticker: string) => void;
}

export function TickerSearch({ onSelect }: TickerSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [hideImages, setHideImages] = useState<Set<string>>(new Set());
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredStocks = query.trim()
    ? POPULAR_STOCKS.filter(
        (stock) =>
          stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
          stock.name.toLowerCase().includes(query.toLowerCase())
      )
        // Deduplicate by symbol (keep first occurrence)
        .filter((stock, index, self) => 
          index === self.findIndex((s) => s.symbol === stock.symbol)
        )
        .slice(0, 10)
    : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (symbol: string, name: string) => {
    setQuery(`${symbol} - ${name}`);
    setIsOpen(false);
    onSelect(symbol);
  };

  const handleImageError = (domain: string) => {
    setHideImages((prev) => new Set(prev).add(domain));
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => query.trim() && setIsOpen(true)}
        placeholder="Search ticker or company name..."
        className="w-full px-4 py-3 bg-muted border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring transition"
      />

      {isOpen && filteredStocks.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-popover border border-border rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {filteredStocks.map((stock) => (
            <button
              key={stock.symbol}
              onClick={() => handleSelect(stock.symbol, stock.name)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition text-left border-b border-border last:border-b-0">
              {!hideImages.has(stock.domain) && (
                <img
                  src={`https://icons.duckduckgo.com/ip3/${stock.domain}.ico`}
                  alt=""
                  className="w-6 h-6 rounded"
                  onError={() => handleImageError(stock.domain)}
                />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">{stock.symbol}</span>
                  <span className="text-muted-foreground text-sm truncate">{stock.name}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.trim() && filteredStocks.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-popover border border-border rounded-lg shadow-xl px-4 py-3 text-muted-foreground text-sm">
          No stocks found matching "{query}"
        </div>
      )}
    </div>
  );
}
