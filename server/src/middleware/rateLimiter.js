import rateLimit from 'express-rate-limit';

// Strict limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { message: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});
