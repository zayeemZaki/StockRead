#!/usr/bin/env python3
"""Market Maker Service - S&P 500 Stock Price Fetcher"""

import yfinance as yf
import time
import logging
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv
import os
import pandas as pd

load_dotenv()

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("Missing Supabase credentials. Check your .env file.")

BLACKLIST = ['ANSS', 'DISCA']
CHUNK_SIZE = 50


class MarketMakerService:
    """Service for fetching and updating S&P 500 stock prices."""
    
    def __init__(self):
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.tickers = self.get_sp500_tickers()
        logger.info(f"Market Maker Service initialized with {len(self.tickers)} tickers")
    
    def get_sp500_tickers(self):
        """Get S&P 500 ticker list with sanitization and blacklist filtering."""
        raw_tickers = []
        
        try:
            import requests
            url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            
            response = requests.get(url, headers=headers, timeout=10)
            tables = pd.read_html(response.text)
            sp500_table = tables[0]
            
            for col_name in ['Symbol', 'Ticker', 'Ticker symbol', sp500_table.columns[0]]:
                if col_name in sp500_table.columns or col_name == sp500_table.columns[0]:
                    symbols = sp500_table[col_name].astype(str).tolist()
                    symbols = [s.strip() for s in symbols if s and s != 'nan' and 1 <= len(s) <= 5]
                    symbols = list(dict.fromkeys(symbols))
                    
                    if len(symbols) >= 400:
                        raw_tickers = symbols
                        break
        except Exception as e:
            logger.warning(f"Wikipedia fetch failed: {e}")
        
        if not raw_tickers:
            raw_tickers = [
                'A', 'AAL', 'AAPL', 'ABBV', 'ABNB', 'ABT', 'ACGL', 'ACN', 'ADBE', 'ADI',
                'ADM', 'ADP', 'ADSK', 'AEE', 'AEP', 'AES', 'AFL', 'AIG', 'AIZ', 'AJG',
                'AKAM', 'ALB', 'ALGN', 'ALL', 'ALLE', 'AMAT', 'AMCR', 'AMD', 'AME', 'AMGN',
                'AMP', 'AMT', 'AMZN', 'ANET', 'ANSS', 'AON', 'AOS', 'APA', 'APD', 'APH',
                'APTV', 'ARE', 'ATO', 'AVB', 'AVGO', 'AVY', 'AWK', 'AXON', 'AXP', 'AZO',
                'BA', 'BAC', 'BALL', 'BAX', 'BBWI', 'BBY', 'BDX', 'BEN', 'BF.B', 'BKNG',
                'BKR', 'BLDR', 'BLK', 'BMY', 'BR', 'BRK.B', 'BRO', 'BSX', 'BWA', 'BX',
                'BXP', 'C', 'CAG', 'CAH', 'CARR', 'CAT', 'CB', 'CBOE', 'CBRE', 'CCI',
                'CCL', 'CDNS', 'CDW', 'CE', 'CEG', 'CF', 'CFG', 'CHD', 'CHRW', 'CHTR',
                'CI', 'CINF', 'CL', 'CLX', 'CMCSA', 'CME', 'CMG', 'CMI', 'CMS', 'CNC',
                'CNP', 'COF', 'COO', 'COP', 'COR', 'COST', 'CPAY', 'CPB', 'CPRT', 'CPT',
                'CRL', 'CRM', 'CSCO', 'CSGP', 'CSX', 'CTAS', 'CTLT', 'CTRA', 'CTSH', 'CTVA',
                'CVS', 'CVX', 'CZR', 'D', 'DAL', 'DAY', 'DD', 'DE', 'DECK', 'DFS',
                'DG', 'DGX', 'DHI', 'DHR', 'DIS', 'DISCA', 'DLR', 'DLTR', 'DOC', 'DOV', 'DOW',
                'DPZ', 'DRI', 'DTE', 'DUK', 'DVA', 'DVN', 'DXCM', 'EA', 'EBAY', 'ECL',
                'ED', 'EFX', 'EG', 'EIX', 'EL', 'ELV', 'EMN', 'EMR', 'ENPH', 'EOG',
                'EPAM', 'EQIX', 'EQR', 'EQT', 'ES', 'ESS', 'ETN', 'ETR', 'ETSY', 'EVRG',
                'EW', 'EXC', 'EXPD', 'EXPE', 'EXR', 'F', 'FANG', 'FAST', 'FCX', 'FDS',
                'FDX', 'FE', 'FFIV', 'FI', 'FICO', 'FIS', 'FITB', 'FMC', 'FOX', 'FOXA',
                'FRT', 'FSLR', 'FTNT', 'FTV', 'GD', 'GDDY', 'GE', 'GEHC', 'GEN', 'GEV',
                'GILD', 'GIS', 'GL', 'GLW', 'GM', 'GNRC', 'GOOG', 'GOOGL', 'GPC', 'GPN',
                'GRMN', 'GS', 'GWW', 'HAL', 'HAS', 'HBAN', 'HCA', 'HD', 'HES', 'HIG',
                'HII', 'HLT', 'HOLX', 'HON', 'HPE', 'HPQ', 'HRL', 'HSIC', 'HST', 'HSY',
                'HUBB', 'HUM', 'HWM', 'IBM', 'ICE', 'IDXX', 'IEX', 'IFF', 'INCY', 'INTC',
                'INTU', 'INVH', 'IP', 'IPG', 'IQV', 'IR', 'IRM', 'ISRG', 'IT', 'ITW',
                'IVZ', 'J', 'JBHT', 'JBL', 'JCI', 'JKHY', 'JNJ', 'JNPR', 'JPM', 'K',
                'KDP', 'KEY', 'KEYS', 'KHC', 'KIM', 'KKR', 'KLAC', 'KMB', 'KMI', 'KMX',
                'KO', 'KR', 'KVUE', 'L', 'LDOS', 'LEN', 'LH', 'LHX', 'LIN', 'LKQ',
                'LLY', 'LMT', 'LNT', 'LOW', 'LRCX', 'LULU', 'LUV', 'LVS', 'LW', 'LYB',
                'LYV', 'MA', 'MAA', 'MAR', 'MAS', 'MCD', 'MCHP', 'MCK', 'MCO', 'MDLZ',
                'MDT', 'MET', 'META', 'MGM', 'MHK', 'MKC', 'MKTX', 'MLM', 'MMC', 'MMM',
                'MNST', 'MO', 'MOH', 'MOS', 'MPC', 'MPWR', 'MRK', 'MRNA', 'MRO', 'MS',
                'MSCI', 'MSFT', 'MSI', 'MTB', 'MTCH', 'MTD', 'MU', 'NCLH', 'NDAQ', 'NDSN',
                'NEE', 'NEM', 'NFLX', 'NI', 'NKE', 'NOC', 'NOW', 'NRG', 'NSC', 'NTAP',
                'NTRS', 'NUE', 'NVDA', 'NVR', 'NWS', 'NWSA', 'NXPI', 'O', 'ODFL', 'OKE',
                'OMC', 'ON', 'ORCL', 'ORLY', 'OTIS', 'OXY', 'PANW', 'PARA', 'PAYC', 'PAYX',
                'PCAR', 'PCG', 'PEG', 'PEP', 'PFE', 'PFG', 'PG', 'PGR', 'PH', 'PHM',
                'PKG', 'PLD', 'PM', 'PNC', 'PNR', 'PNW', 'PODD', 'POOL', 'PPG', 'PPL',
                'PRU', 'PSA', 'PSX', 'PTC', 'PWR', 'PYPL', 'QCOM', 'QRVO', 'RCL', 'REG',
                'REGN', 'RF', 'RJF', 'RL', 'RMD', 'ROK', 'ROL', 'ROP', 'ROST', 'RSG',
                'RTX', 'RVTY', 'SBAC', 'SBUX', 'SCHW', 'SHW', 'SJM', 'SLB', 'SMCI', 'SNA',
                'SNPS', 'SO', 'SOFi', 'SPG', 'SPGI', 'SRE', 'STE', 'STLD', 'STT', 'STX',
                'STZ', 'SWK', 'SWKS', 'SYF', 'SYK', 'SYY', 'T', 'TAP', 'TDG', 'TDY',
                'TECH', 'TEL', 'TER', 'TFC', 'TFX', 'TGT', 'TJX', 'TMO', 'TMUS', 'TPR',
                'TRGP', 'TRMB', 'TROW', 'TRV', 'TSCO', 'TSLA', 'TSN', 'TT', 'TTWO', 'TXN',
                'TXT', 'TYL', 'UAL', 'UBER', 'UDR', 'UHS', 'ULTA', 'UNH', 'UNP', 'UPS',
                'URI', 'USB', 'V', 'VICI', 'VLO', 'VLTO', 'VMC', 'VRSK', 'VRSN', 'VRTX',
                'VST', 'VTR', 'VTRS', 'VZ', 'WAB', 'WAT', 'WBA', 'WBD', 'WDC', 'WEC',
                'WELL', 'WFC', 'WM', 'WMB', 'WMT', 'WRB', 'WRK', 'WST', 'WTW', 'WY',
                'WYNN', 'XEL', 'XOM', 'XYL', 'YUM', 'ZBH', 'ZBRA', 'ZTS'
            ]
        
        sanitized_tickers = [ticker.replace('.', '-') for ticker in raw_tickers]
        sanitized_tickers = list(dict.fromkeys(sanitized_tickers))
        filtered_tickers = [ticker for ticker in sanitized_tickers if ticker not in BLACKLIST]
        
        logger.info(f"Loaded {len(filtered_tickers)} S&P 500 tickers")
        return filtered_tickers

    def fetch_all_stock_prices(self) -> list:
        """Fetch live stock prices for all tickers using chunked downloads."""
        stock_data_list = []
        total_tickers = len(self.tickers)
        start_time = time.time()
        num_chunks = (total_tickers + CHUNK_SIZE - 1) // CHUNK_SIZE
        
        for chunk_idx in range(num_chunks):
            start_idx = chunk_idx * CHUNK_SIZE
            end_idx = min(start_idx + CHUNK_SIZE, total_tickers)
            chunk_tickers = self.tickers[start_idx:end_idx]
            
            try:
                df = yf.download(
                    chunk_tickers,
                    period="1d",
                    interval="1d",
                    group_by='ticker',
                    progress=False,
                    threads=True
                )
                
                chunk_success = 0
                
                if len(chunk_tickers) == 1:
                    ticker = chunk_tickers[0]
                    if not df.empty and 'Close' in df.columns:
                        self._process_single_ticker(ticker, df, stock_data_list)
                        chunk_success += 1
                else:
                    for ticker in chunk_tickers:
                        try:
                            if ticker not in df.columns.get_level_values(0):
                                continue
                            
                            ticker_df = df[ticker]
                            self._process_single_ticker(ticker, ticker_df, stock_data_list)
                            chunk_success += 1
                        except Exception as e:
                            logger.warning(f"{ticker} error: {e}")
                            continue
                
            except Exception as chunk_error:
                logger.error(f"Chunk {chunk_idx + 1} failed: {chunk_error}")
            
            if chunk_idx < num_chunks - 1:
                time.sleep(1)
        
        elapsed = time.time() - start_time
        logger.info(f"Downloaded {len(stock_data_list)}/{total_tickers} stocks in {elapsed:.2f}s")
        
        return stock_data_list

    def _process_single_ticker(self, ticker: str, ticker_df: pd.DataFrame, stock_data_list: list):
        """Process a single ticker's DataFrame and append to stock_data_list."""
        try:
            if ticker_df.empty or 'Close' not in ticker_df.columns:
                return
            
            latest = ticker_df.iloc[-1]
            current_price = latest['Close']
            open_price = latest['Open']
            
            if pd.isna(current_price) or pd.isna(open_price):
                return
            
            if len(ticker_df) > 1:
                prev_close = ticker_df.iloc[-2]['Close']
                if pd.isna(prev_close):
                    prev_close = open_price
            else:
                prev_close = open_price
            
            change = current_price - prev_close
            change_percent = (change / prev_close) * 100 if prev_close > 0 else 0
            
            stock_data_list.append({
                'symbol': ticker,
                'price': round(float(current_price), 2),
                'change_percent': round(float(change_percent), 2),
                'updated_at': datetime.now(timezone.utc).isoformat()
            })
            
        except Exception as e:
            logger.warning(f"{ticker} processing error: {e}")

    def save_bulk_to_supabase(self, stock_data_list: list) -> int:
        """Batch upsert stock prices to Supabase using chunked approach."""
        if not stock_data_list:
            return 0
        
        db_chunk_size = 100
        saved = 0
        
        for i in range(0, len(stock_data_list), db_chunk_size):
            chunk = stock_data_list[i:i + db_chunk_size]
            
            try:
                self.supabase.table('market_prices').upsert(chunk, on_conflict='symbol').execute()
                saved += len(chunk)
            except Exception as chunk_error:
                logger.error(f"Database chunk failed: {chunk_error}")
        
        logger.info(f"Saved {saved}/{len(stock_data_list)} stocks")
        return saved

    def update_market(self):
        """Main update function: Fetch all prices and save to database."""
        logger.info(f"Market update started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        stock_data = self.fetch_all_stock_prices()
        
        if not stock_data:
            logger.warning("No stock data retrieved, skipping database update")
            return
        
        saved_count = self.save_bulk_to_supabase(stock_data)
        
        gainers = sum(1 for s in stock_data if s['change_percent'] > 0)
        losers = sum(1 for s in stock_data if s['change_percent'] < 0)
        unchanged = sum(1 for s in stock_data if s['change_percent'] == 0)
        
        logger.info(f"Market update complete: {len(stock_data)} stocks, {gainers} gainers, {losers} losers, {saved_count} saved")

    def run(self):
        """Main loop - continuously fetch and update S&P 500 prices."""
        logger.info(f"Market Maker started - tracking {len(self.tickers)} stocks, update interval: 5 minutes")
        
        try:
            while True:
                self.update_market()
                time.sleep(300)
        
        except KeyboardInterrupt:
            logger.info("Market Maker stopped by user")
        
        except Exception as e:
            logger.error(f"Fatal error: {e}", exc_info=True)

