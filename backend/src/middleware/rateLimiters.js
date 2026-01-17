const rateLimit = require('express-rate-limit');

/**
 * Global Rate Limiter
 * Applied to all routes to prevent basic DDoS and abuse.
 * Rule: Max 100 requests per 15 minutes per IP.
 */
exports.globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 429,
    error: 'Too many requests, please try again later.'
  }
});

/**
 * AI Rate Limiter
 * Applied to expensive AI generation endpoints.
 * Rule: Max 15 requests per 1 hour per IP.
 */
exports.aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // Limit each IP to 15 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Rate limit exceeded for AI generation. Please wait.'
  }
});

/**
 * Webhook Rate Limiter
 * Applied to webhook endpoints to allow bursts but prevent flooding.
 * Rule: Max 200 requests per 1 minute per IP.
 */
exports.webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
  message: {
    status: 429,
    error: 'Too many webhook requests.'
  }
});
