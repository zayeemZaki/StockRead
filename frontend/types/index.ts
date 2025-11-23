export interface Profile {
  username: string;
  avatar_url: string;
}

export interface Reaction {
  user_id: string;
}

export interface Comment {
  id: number;
  content: string;
  created_at: string;
  user_id: string;
  profiles: Profile;
}

export interface Post {
  id: number;
  ticker: string;
  content: string;
  ai_score: number;
  ai_risk: string;
  ai_summary: string;
  user_sentiment_label: string;
  created_at: string;
  user_id: string;
  profiles: Profile;
  reactions: Reaction[];
  comments: { id: number }[];
  price_history?: number[];
  raw_market_data?: {
    price: number;
    change_percent: number;
    volume: number;
    market_cap: string;
    pe_ratio: number | string;
    peg_ratio: number | string;
    short_ratio: number | string;
    fiftyTwoWeekHigh: number | string;
    beta: number | string;
  };
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
