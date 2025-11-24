'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { MarketSidebar } from './market-sidebar';

export function MobileMarketSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open market watch</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[400px]">
        <SheetTitle className="sr-only">Market Watch</SheetTitle>
        <div className="h-full overflow-y-auto">
          <MarketSidebar mobile />
        </div>
      </SheetContent>
    </Sheet>
  );
}