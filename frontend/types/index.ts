export interface Profile {
  id?: string;
  username: string;
  avatar_url: string | null;
  reputation_score?: number;
  created_at?: string;
}

export interface Reaction {
  id?: number;
  user_id: string;
  post_id?: number;
  created_at?: string;
}

export interface Comment {
  id: number;
  content: string;
  created_at: string;
  user_id: string;
  post_id?: number;
  profiles: Profile;
  posts?: Post; // For nested post reference
}

export interface Post {
  id: number;
  ticker: string;
  content: string;
  ai_score: number | null;
  ai_risk: string | null;
  ai_summary: string | null;
  user_sentiment_label: string | null;
  created_at: string;
  user_id: string;
  profiles?: Profile;
  author_username?: string; // Denormalized field
  author_avatar?: string | null; // Denormalized field
  reactions?: Reaction[];
  comments?: Comment[] | { id: number }[];
  price_history?: number[] | null;
  raw_market_data?: {
    price?: number | string;
    change_percent?: number | string;
    volume?: number | string;
    market_cap?: string;
    pe_ratio?: number | string | null;
    peg_ratio?: number | string | null;
    short_ratio?: number | string | null;
    fiftyTwoWeekHigh?: number | string | null;
    fiftyTwoWeekLow?: number | string | null;
    beta?: number | string | null;
    recommendationKey?: string | null;
    targetMean?: number | string | null;
    sector?: string | null;
    industry?: string | null;
    [key: string]: unknown; // Allow additional fields
  } | null;
  analyst_rating?: string | null;
  target_price?: number | null;
  short_float?: number | null;
  insider_held?: number | null;
}

export interface Stock {
  symbol: string;
  name: string;
  domain: string;
}

export interface TickerInsight {
  ticker: string;
  ai_score: number;
  ai_signal: string;
  ai_risk: string;
  ai_summary?: string;
  current_price?: number | null;
  market_cap?: string | null;
  pe_ratio?: number | null;
  analyst_rating?: string | null;
  target_price?: number | null;
  short_float?: number | null;
  insider_held?: number | null;
  updated_at?: string;
}
