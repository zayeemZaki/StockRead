/**
 * Input sanitization utilities to prevent XSS and injection attacks.
 */

/**
 * Sanitize ticker symbol - only allow alphanumeric characters, max 10 chars
 */
export function sanitizeTicker(ticker: string): string {
  if (!ticker || typeof ticker !== 'string') {
    return '';
  }
  // Remove all non-alphanumeric characters, uppercase, limit length
  const sanitized = ticker.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
  return sanitized;
}

/**
 * Sanitize user content - remove HTML/JS and dangerous characters
 */
export function sanitizeContent(content: string, maxLength: number = 5000): string {
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  // Trim whitespace
  let sanitized = content.trim();
  
  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove script tags and event handlers
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: and data: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:text\/html/gi, '');
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize news title/description - remove HTML and limit length
 */
export function sanitizeNewsText(text: string | null | undefined, maxLength: number = 500): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Remove HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = sanitized;
  sanitized = textarea.value;
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + '...';
  }
  
  return sanitized.trim();
}

/**
 * Sanitize URL - validate and clean URLs
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  try {
    const parsed = new URL(url);
    // Only allow http/https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Escape HTML entities for safe rendering
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

