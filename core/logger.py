"""
Structured logging utility
Provides consistent logging across the application with proper context
"""
import logging
import sys
from typing import Any, Optional

def setup_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """
    Create a configured logger instance
    
    Args:
        name: Logger name (typically __name__)
        level: Logging level (default: INFO)
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Avoid duplicate handlers if logger already configured
    if logger.handlers:
        return logger
    
    logger.setLevel(level)
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    handler.setFormatter(formatter)
    
    logger.addHandler(handler)
    
    return logger

def log_error(logger: logging.Logger, operation: str, error: Exception, context: Optional[dict[str, Any]] = None) -> None:
    """
    Log an error with structured context
    
    Args:
        logger: Logger instance
        operation: Operation that failed
        error: Exception that occurred
        context: Additional context data
    """
    context_str = f" Context: {context}" if context else ""
    logger.error(f"{operation} failed: {str(error)}{context_str}", exc_info=True)

def log_warning(logger: logging.Logger, message: str, context: Optional[dict[str, Any]] = None) -> None:
    """
    Log a warning with structured context
    
    Args:
        logger: Logger instance
        message: Warning message
        context: Additional context data
    """
    context_str = f" Context: {context}" if context else ""
    logger.warning(f"{message}{context_str}")

def log_info(logger: logging.Logger, message: str, context: Optional[dict[str, Any]] = None) -> None:
    """
    Log info with structured context
    
    Args:
        logger: Logger instance
        message: Info message
        context: Additional context data
    """
    context_str = f" | {context}" if context else ""
    logger.info(f"{message}{context_str}")

