"""Redis utility functions for URL normalization and connection handling."""
import os
import re
import logging

logger = logging.getLogger(__name__)


def normalize_redis_url(redis_url: str | None) -> str | None:
    """
    Normalize Redis URL by extracting it from command strings or fixing common formats.
    
    Handles cases like:
    - "redis-cli --tls -u redis://..." -> extracts "redis://..."
    - "localhost:6379" -> converts to "redis://localhost:6379"
    - "redis://..." -> returns as-is
    
    Args:
        redis_url: Raw Redis URL string (may contain command or be malformed)
        
    Returns:
        Normalized Redis URL string, or None if invalid
    """
    if not redis_url:
        return None
    
    original_url = redis_url.strip()
    
    # Extract URL from command strings (e.g., "redis-cli --tls -u redis://...")
    if 'redis://' in original_url or 'rediss://' in original_url:
        url_match = re.search(r'(redis[s]?://[^\s]+)', original_url)
        if url_match:
            extracted_url = url_match.group(1)
            # Remove any trailing quotes or command arguments
            extracted_url = extracted_url.rstrip('"\'')
            logger.debug(f"Extracted Redis URL from command string")
            return extracted_url
    
    # If it already starts with a valid scheme, return as-is
    if original_url.startswith(('redis://', 'rediss://', 'unix://')):
        return original_url
    
    # Auto-fix common cases: if it looks like host:port, prepend redis://
    if '://' not in original_url and (':' in original_url or original_url.startswith('localhost')):
        fixed_url = f"redis://{original_url}"
        logger.debug(f"Auto-fixed Redis URL format")
        return fixed_url
    
    # Invalid format
    logger.warning(f"Invalid Redis URL format: {original_url[:50]}...")
    return None


def get_redis_url() -> str | None:
    """
    Get and normalize Redis URL from environment variable.
    
    Returns:
        Normalized Redis URL or None if not configured
    """
    raw_url = os.getenv("REDIS_URL")
    return normalize_redis_url(raw_url)

