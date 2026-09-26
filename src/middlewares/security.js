import rateLimit from 'express-rate-limit';

// Rate Limiter middleware
export const apiLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 10 seconds',
  },
});

// JSON keys containing MongoDB operators are never accepted as user input.
export const sanitizeInputs = (req, res, next) => {
  const unsafe = value => value && typeof value === 'object' && Object.entries(value).some(([key, child]) => key.startsWith('$') || key.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(key) || unsafe(child));
  if (unsafe(req.body) || unsafe(req.query)) return res.status(400).json({ success: false, message: 'Invalid input keys' });
  next();
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' }
});

export const validateAuthInput = (req, res, next) => {
  for (const field of ['email', 'password', 'newPassword', 'otp', 'name', 'role']) {
    if (req.body?.[field] !== undefined && typeof req.body[field] !== 'string') return res.status(400).json({ success: false, message: field + ' must be a string' });
  }
  next();
};
