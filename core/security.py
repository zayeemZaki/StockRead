"""Security utilities for sanitizing sensitive data in logs."""
import re


def sanitize_log_message(message: str) -> str:
    """
    Sanitize log messages to prevent API key leakage.
    Removes or masks sensitive information like API keys.
    
    Args:
        message: Log message that may contain sensitive data
        
    Returns:
        Sanitized message with sensitive data masked
    """
    if not message:
        return message
    
    # Mask Google API keys (format: AIza...)
    message = re.sub(r'AIza[0-9A-Za-z_-]{35}', 'AIza***MASKED***', message)
    
    # Mask any environment variable values that look like keys
    message = re.sub(r'GOOGLE_API_KEY["\']?\s*[:=]\s*["\']?([^"\'\s]+)', 
                     r'GOOGLE_API_KEY="***MASKED***"', message)
    
    # Mask any long alphanumeric strings that might be keys
    message = re.sub(r'\b([A-Za-z0-9_-]{40,})\b', 
                     lambda m: m.group(1)[:8] + '***MASKED***' if len(m.group(1)) > 40 else m.group(1),
                     message)
    
    return message

