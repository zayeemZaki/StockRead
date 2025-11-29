/**
 * Application-wide constants
 * Centralized configuration values to avoid magic numbers and improve maintainability
 */

// Layout Constants
export const LAYOUT = {
  NAVBAR_HEIGHT: 56, // h-14 in Tailwind = 56px
  MOBILE_BOTTOM_BAR_HEIGHT: 64, // h-16 in Tailwind = 64px
  MOBILE_BREAKPOINT: 768, // md breakpoint in Tailwind
} as const;

// Tutorial Constants
export const TUTORIAL = {
  STORAGE_KEY: 'stockread_tutorial_completed',
  TOOLTIP_WIDTH_MOBILE: 400,
  TOOLTIP_WIDTH_DESKTOP: 380,
  TOOLTIP_HEIGHT: 280,
  MIN_SPACING: 80,
  SAFE_TOP_MOBILE: 24,
  SAFE_TOP_DESKTOP_OFFSET: 120,
  SAFE_BOTTOM_MOBILE: 88, // MOBILE_BOTTOM_BAR_HEIGHT + 24
  SAFE_BOTTOM_DESKTOP: 40,
  SAFE_SIDE_PADDING: 24,
  INITIAL_DELAY_MS: 300,
  TRANSITION_DURATION_MS: 300,
  ELEMENT_RETRY_DELAY_MS: 400,
  MAX_ELEMENT_RETRIES: 5,
  POSITION_UPDATE_INTERVAL_MS: 300,
  POSITION_UPDATE_DELAYS: [200, 500, 1000] as const,
  // Special offset for market sidebar highlight on desktop
  MARKET_SIDEBAR_TOP_OFFSET_DESKTOP: 100,
  MARKET_SIDEBAR_TOP_OFFSET_MOBILE: 4,
} as const;

// Cache TTL Constants (in seconds)
export const CACHE_TTL = {
  STOCK_PRICE: 300, // 5 minutes
  NEWS: 3600, // 1 hour
  MARKET_DATA: 300, // 5 minutes
} as const;

// API Timeouts (in seconds)
export const TIMEOUTS = {
  AI_API: 60,
  NEWS_API: 30,
  MARKET_DATA: 15,
} as const;

// Retry Configuration
export const RETRY = {
  MAX_ATTEMPTS: 3,
  BACKOFF_MS: 500,
  NEWS_FETCH_DELAY_MS: 500,
} as const;

// Pagination
export const PAGINATION = {
  POSTS_PER_PAGE: 10,
  NEWS_PER_FETCH: 100,
  INFINITE_SCROLL_THRESHOLD: 100, // pixels before triggering load
} as const;

// VIX Sentiment Thresholds
export const VIX_THRESHOLDS = {
  VERY_CALM: 12,
  CALM: 20,
  ELEVATED: 30,
  HIGH_VOLATILITY: 40,
} as const;

export const MARKET_SENTIMENT = {
  VERY_CALM: 'Very Calm',
  CALM: 'Calm',
  ELEVATED: 'Elevated',
  HIGH_VOLATILITY: 'High Volatility',
  EXTREME_FEAR: 'Extreme Fear',
  UNKNOWN: 'Unknown',
} as const;

// AI Analysis Valid Values
export const AI_ANALYSIS = {
  USER_THESIS: ['Bullish', 'Bearish', 'Neutral'] as const,
  RISK_LEVELS: ['Low', 'Medium', 'High', 'Extreme'] as const,
  DEFAULT_THESIS: 'Neutral',
  DEFAULT_RISK: 'Medium',
  DEFAULT_SCORE: 50,
} as const;

// URL Tracking Parameters to Remove
export const TRACKING_PARAMS = [
  'ved',
  'usg',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  '_ga',
] as const;

// News Validation
export const NEWS_VALIDATION = {
  MIN_TITLE_LENGTH: 10,
  MAX_SPECIAL_CHAR_RATIO: 0.3,
  SPAM_KEYWORDS: [
    'click here',
    'buy now',
    'limited time',
    'act now',
    'free money',
    'get rich',
  ] as const,
  SUSPICIOUS_DOMAINS: [
    'bit.ly',
    'tinyurl.com',
    't.co',
    'goo.gl',
  ] as const,
} as const;

