/**
 * Tutorial Configuration
 * Defines tutorial steps and their target elements
 */

import React from 'react';
import { Sparkles, TrendingUp, MessageSquare, Search, BarChart3 } from 'lucide-react';

export interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector: string;
  action?: 'click' | 'observe';
  waitForAction?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Welcome to Stock Read',
    description: 'Your AI-powered platform for market insights and social trading signals. Let\'s take a quick tour!',
    icon: <Sparkles className="w-6 h-6 text-primary" />,
    targetSelector: 'body',
    action: 'observe',
    waitForAction: false,
    position: 'center',
  },
  {
    title: 'Explore the Feed',
    description: 'Here are signals from the community. Try clicking on one of the filter buttons below to see different views.',
    icon: <TrendingUp className="w-6 h-6 text-primary" />,
    targetSelector: '[data-tutorial="feed-filters"]',
    action: 'click',
    waitForAction: true,
    position: 'bottom',
  },
  {
    title: 'Create Your Signal',
    description: 'Ready to share your market thesis? Click the "Drop a signal..." button to create your first post.',
    icon: <MessageSquare className="w-6 h-6 text-primary" />,
    targetSelector: '[data-tutorial="create-post"]',
    action: 'click',
    waitForAction: true,
    position: 'bottom',
  },
  {
    title: 'Search & Discover',
    description: 'Use the search feature to find stocks, users, or topics. Press ⌘K (or Ctrl+K) or click the search icon.',
    icon: <Search className="w-6 h-6 text-primary" />,
    targetSelector: '[data-tutorial="search"]',
    action: 'click',
    waitForAction: true,
    position: 'bottom',
  },
  {
    title: 'Track Markets',
    description: 'Check out the market sidebar for live prices and trending news. Click on any stock to see detailed analysis.',
    icon: <BarChart3 className="w-6 h-6 text-primary" />,
    targetSelector: '[data-tutorial="market-sidebar"]',
    action: 'click',
    waitForAction: true,
    position: 'left',
  },
];

export function getTutorialDescription(step: TutorialStep, isMobile: boolean): string {
  if (step.targetSelector === '[data-tutorial="market-sidebar"]' && isMobile) {
    return 'Tap the Market tab at the bottom to view live prices and trending news. You can also access it from the markets page.';
  }
  return step.description;
}
