"""News Service for fetching and updating market news."""

from GoogleNews import GoogleNews
from services.db_service import DatabaseService
import logging
import warnings
import yfinance as yf
import requests
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from datetime import datetime
import time
import re

logger = logging.getLogger(__name__)

# Suppress yfinance TzCache warnings
yfinance_logger = logging.getLogger('yfinance')
yfinance_logger.setLevel(logging.WARNING)
warnings.filterwarnings('ignore', message='.*TzCache.*')


class NewsService:
    """Service for fetching and updating market news."""
    
    def __init__(self):
        self.db = DatabaseService()
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        logger.info("News Service initialized")
    
    def _clean_url(self, url: str) -> str:
        """
        Clean URL by removing Google tracking parameters and fixing malformed URLs.
        
        Args:
            url: URL that may contain tracking parameters
            
        Returns:
            Cleaned URL without tracking parameters
        """
        if not url or not isinstance(url, str):
            return url or ''
        
        try:
            # Fix URLs that have & instead of ? for query params (malformed)
            if '&ved=' in url and '?' not in url.split('://')[1].split('/')[0]:
                # Find where query params start (first & after domain)
                parts = url.split('://', 1)
                if len(parts) == 2:
                    scheme = parts[0]
                    rest = parts[1]
                    # Find first & that's likely a query param
                    if '&' in rest:
                        path_part, query_part = rest.split('&', 1)
                        url = f"{scheme}://{path_part}?{query_part}"
            
            parsed = urlparse(url)
            
            # Remove Google tracking parameters
            query_params = parse_qs(parsed.query, keep_blank_values=True)
            params_to_remove = ['ved', 'usg', 'utm_source', 'utm_medium', 'utm_campaign', 
                               'utm_term', 'utm_content', 'gclid', 'fbclid', '_ga']
            
            cleaned_params = {k: v for k, v in query_params.items() 
                                if k.lower() not in params_to_remove}
            
            # Reconstruct URL without tracking parameters
            if cleaned_params:
                new_query = urlencode(cleaned_params, doseq=True)
            else:
                new_query = ''
            
            cleaned_url = urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                new_query,
                ''  # Remove fragment
            ))
            
            return cleaned_url
            
        except Exception as e:
            logger.warning(f"Failed to clean URL {url[:50]}...: {str(e)}")
            return url
    
    def _is_valid_news_item(self, title: str, source: str, link: str) -> bool:
        """
        Validate news item to filter out spam and low-quality content.
        
        Args:
            title: News title
            source: News source
            link: News URL
            
        Returns:
            True if news item is valid, False otherwise
        """
        if not title or not isinstance(title, str):
            return False
        
        title_lower = title.lower().strip()
        
        # Filter out spam indicators
        spam_keywords = [
            'click here', 'download now', 'free money', 'guaranteed profit',
            'make money fast', 'work from home', 'get rich quick'
        ]
        
        if any(keyword in title_lower for keyword in spam_keywords):
            return False
        
        # STRICT: Filter out non-English sources (check source name first)
        if source and isinstance(source, str):
            source_non_ascii = re.findall(r'[^\x00-\x7F]', source)
            # If source has ANY non-ASCII characters, reject (e.g., "BỘ NỘI VỤ")
            if len(source_non_ascii) > 0:
                logger.debug(f"Rejected non-English source: {source}")
                return False
        
        # STRICT: Filter out non-English titles
        # Check for non-ASCII characters (excluding common currency symbols and punctuation)
        # Common allowed: $, €, £, ¥, ©, ®, ™, etc. - but we'll be strict
        non_ascii_chars = re.findall(r'[^\x00-\x7F]', title)
        
        # Reject if ANY significant non-ASCII characters found (very strict)
        # Allow only common punctuation that might appear in English text
        allowed_chars = set(['$', '€', '£', '¥', '©', '®', '™', '°', '–', '—', '…'])
        significant_non_ascii = [c for c in non_ascii_chars if c not in allowed_chars]
        
        if len(significant_non_ascii) > 0:
            logger.debug(f"Rejected non-English title: {title[:50]}... (found: {significant_non_ascii[:3]})")
            return False
        
        # Additional check: If title starts with non-ASCII, definitely reject
        if title and len(title) > 0 and ord(title[0]) > 127 and title[0] not in allowed_chars:
            logger.debug(f"Rejected title starting with non-ASCII: {title[:50]}...")
            return False
        
        # Check for common non-English language patterns
        # Vietnamese, Chinese, Japanese, Arabic, etc. character ranges
        vietnamese_pattern = re.search(r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', title, re.IGNORECASE)
        chinese_japanese_pattern = re.search(r'[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]', title)
        arabic_pattern = re.search(r'[\u0600-\u06ff]', title)
        cyrillic_pattern = re.search(r'[\u0400-\u04ff]', title)
        
        if vietnamese_pattern or chinese_japanese_pattern or arabic_pattern or cyrillic_pattern:
            logger.debug(f"Rejected title with non-English language pattern: {title[:50]}...")
            return False
        
        # Filter out very short titles (likely spam)
        if len(title.strip()) < 10:
            return False
        
        # Filter out titles that are mostly special characters
        if len(re.sub(r'[a-zA-Z0-9\s]', '', title)) > len(title) * 0.5:
            return False
        
        # Validate URL
        if not link or not isinstance(link, str):
            return False
        
        if not link.startswith(('http://', 'https://')):
            return False
        
        # Filter out suspicious domains
        suspicious_domains = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl']
        if any(domain in link.lower() for domain in suspicious_domains):
            return False
        
        return True
    
    def _resolve_google_news_link(self, url: str) -> str:
        """
        Resolve Google News redirect links to actual article URLs.
        
        Args:
            url: Google News redirect URL
            
        Returns:
            Resolved direct URL or original URL if resolution fails
        """
        if not url or not isinstance(url, str):
            return url or ''
        
        # First clean the URL to remove tracking parameters
        url = self._clean_url(url)
        
        # Check if it's a Google News redirect
        if 'news.google.com' in url or 'google.com/url' in url:
            try:
                # Follow redirects to get actual URL
                response = self.session.head(url, allow_redirects=True, timeout=5)
                resolved_url = response.url
                
                # Clean the resolved URL
                resolved_url = self._clean_url(resolved_url)
                
                # If still a Google redirect, try to extract from query params
                if 'google.com' in resolved_url and 'url=' in resolved_url:
                    parsed = urlparse(resolved_url)
                    query_params = parse_qs(parsed.query)
                    if 'url' in query_params:
                        resolved_url = query_params['url'][0]
                        resolved_url = self._clean_url(resolved_url)
                
                # Validate the resolved URL
                if resolved_url and resolved_url != url and 'http' in resolved_url:
                    logger.debug(f"Resolved Google News link: {url[:50]}... -> {resolved_url[:50]}...")
                    return resolved_url
            except Exception as e:
                logger.warning(f"Failed to resolve Google News link {url[:50]}...: {str(e)}")
        
        return url
    
    def _fetch_yahoo_news(self, topics: list, limit_per_topic: int = 10) -> list:
        """
        Fetch news from Yahoo Finance using major market tickers.
        
        Args:
            topics: List of topics to search (will use related tickers)
            limit_per_topic: Number of articles per topic
            
        Returns:
            List of news items
        """
        news_items = []
        # Map topics to relevant tickers for Yahoo Finance
        topic_tickers = {
            "Stock Market": ["SPY", "QQQ", "DIA"],
            "Economy": ["^GSPC", "^DJI", "^IXIC"],
            "Crypto": ["BTC-USD", "ETH-USD"],
            "Federal Reserve": ["^TNX", "^FVX", "DXY"]
        }
        
        seen_titles = set()  # Deduplicate by title
        
        for topic in topics:
            tickers = topic_tickers.get(topic, ["SPY"])  # Default to SPY
            
            for ticker in tickers:
                try:
                    stock = yf.Ticker(ticker)
                    news = stock.news
                    
                    if news:
                        for article in news[:limit_per_topic]:
                            title = article.get('title', '').strip()
                            if not title or title in seen_titles:
                                continue
                            
                            seen_titles.add(title)
                            
                            # Yahoo Finance news has direct links
                            link = article.get('link', '')
                            if not link or 'yahoo.com' not in link:
                                # Sometimes link is in uuid format, construct proper URL
                                if 'uuid' in article:
                                    link = f"https://finance.yahoo.com/news/{article.get('uuid', '')}"
                            
                            # Clean URL to remove any tracking parameters
                            cleaned_link = self._clean_url(link or '')
                            source = article.get('publisher', 'Yahoo Finance')
                            
                            # Validate news item before adding
                            if not self._is_valid_news_item(title, source, cleaned_link):
                                logger.debug(f"Filtered out invalid news item: {title[:50]}...")
                                continue
                            
                            # Parse date
                            pub_date = article.get('providerPublishTime', 0)
                            if pub_date:
                                try:
                                    date_str = datetime.fromtimestamp(pub_date).strftime('%Y-%m-%d %H:%M:%S')
                                except:
                                    date_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                            else:
                                date_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                            
                            news_items.append({
                                'title': title,
                                'source': source,
                                'link': cleaned_link,
                                'date': date_str
                            })
                    
                    time.sleep(0.5)  # Rate limiting
                except Exception as e:
                    logger.warning(f"Failed to fetch Yahoo Finance news for {ticker}: {str(e)}")
                    continue
        
        return news_items
    
    def _fetch_google_news(self, topics: list, limit_per_topic: int = 10) -> list:
        """
        Fetch news from Google News with link resolution.
        
        Args:
            topics: List of topics to search
            limit_per_topic: Number of articles per topic
            
        Returns:
            List of news items with resolved links
        """
        all_news = []
        googlenews = GoogleNews(lang='en', region='US', period='7d')
        
        for topic in topics:
            try:
                googlenews.search(topic)
                results = googlenews.result()
                
                for item in results[:limit_per_topic]:
                    title = item.get('title', '').strip()
                    source = item.get('media', 'Unknown')
                    link = item.get('link', '')
                    
                    # Resolve Google News redirect links and clean tracking parameters
                    resolved_link = self._resolve_google_news_link(link)
                    cleaned_link = self._clean_url(resolved_link)
                    
                    # Validate news item before adding
                    if not self._is_valid_news_item(title, source, cleaned_link):
                        logger.debug(f"Filtered out invalid news item: {title[:50]}...")
                        continue
                    
                    news_item = {
                        'title': title,
                        'source': source,
                        'link': cleaned_link,
                        'date': item.get('date', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
                    }
                    
                    all_news.append(news_item)
                
                googlenews.clear()
                time.sleep(1)  # Rate limiting between searches
            except Exception as e:
                logger.error(f"Error fetching Google News for topic '{topic}': {str(e)}")
                continue
        
        return all_news
    
    def update_market_news(self):
        """Fetch and update market news from multiple sources."""
        topics = ["Stock Market", "Economy", "Crypto", "Federal Reserve"]
        all_news = []
        seen_titles = set()
        
        # Fetch from Yahoo Finance (better links, more reliable)
        logger.info("Fetching news from Yahoo Finance...")
        yahoo_news = self._fetch_yahoo_news(topics, limit_per_topic=10)
        for item in yahoo_news:
            title_lower = item['title'].lower().strip()
            if title_lower not in seen_titles:
                seen_titles.add(title_lower)
                all_news.append(item)
        
        # Fetch from Google News (as backup, with link resolution)
        logger.info("Fetching news from Google News...")
        google_news = self._fetch_google_news(topics, limit_per_topic=8)
        for item in google_news:
            title_lower = item['title'].lower().strip()
            if title_lower not in seen_titles:
                seen_titles.add(title_lower)
                all_news.append(item)
        
        logger.info(f"Fetched {len(all_news)} unique news articles")
        
        # Clear existing news
        try:
            self.db.supabase.table("market_news").delete().neq("id", 0).execute()
        except Exception as e:
            logger.warning(f"Error clearing existing news: {e}")
        
        # Insert new news (limit to 100 to avoid database issues)
        inserted_count = 0
        for item in all_news[:100]:
            try:
                # Final validation check before inserting (safety net)
                if not self._is_valid_news_item(item['title'], item['source'], item['link']):
                    logger.debug(f"Skipping invalid news item during insertion: {item['title'][:50]}...")
                    continue
                
                data = {
                    "title": item['title'],
                    "source": item['source'],
                    "url": item['link'],
                    "published_at": item['date']
                }
                self.db.supabase.table("market_news").insert(data).execute()
                inserted_count += 1
            except Exception as e:
                logger.error(f"Error inserting news item '{item['title'][:50]}...': {e}")
        
        logger.info(f"Successfully inserted {inserted_count} news articles")

