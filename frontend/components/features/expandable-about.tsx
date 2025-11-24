'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableAboutProps {
  symbol: string;
  summary: string;
}

export function ExpandableAbout({ symbol, summary }: ExpandableAboutProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!summary || summary === 'No company description available.') {
    return null;
  }

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Building2 className="w-3.5 h-3.5" />
          About {symbol}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p 
          className={`text-xs text-muted-foreground leading-relaxed ${
            isExpanded ? '' : 'line-clamp-4'
          }`}
        >
          {summary}
        </p>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-xs font-medium text-primary hover:underline flex items-center gap-1"
        >
          {isExpanded ? (
            <>
              Show Less
              <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              Read More
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </CardContent>
    </Card>
  );
}

