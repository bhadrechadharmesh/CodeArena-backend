import rateLimit from 'express-rate-limit';

// Rate Limiter middleware
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

// Custom XSS Sanitizer middleware
export const sanitizeInputs = (req, res, next) => {
  const sanitize = (val) => {
    if (typeof val === 'string') {
      return val
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // Remove scripts
        .replace(/on\w+="[^"]*"/gi, '') // Remove on-handlers
        .trim();
    }
    if (typeof val === 'object' && val !== null) {
      for (const key in val) {
        val[key] = sanitize(val[key]);
      }
    }
    return val;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);

  next();
};
