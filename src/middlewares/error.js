export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  let error = { ...err };
  error.message = err.message;

  // Log to console for dev
  console.error('Error Details:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new Error(message);
    error.statusCode = 404;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new Error(message);
    error.statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = new Error(message);
    error.statusCode = 400;
  }

  if (err.code === 'LIMIT_FILE_SIZE') { error.statusCode = 413; error.message = 'Upload must be 5 MB or smaller'; }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new Error('Invalid web token');
    error.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    error = new Error('Expired web token');
    error.statusCode = 401;
  }

  res.status(error.statusCode || err.status || 500).json({
    success: false,
    message: (error.statusCode || err.status || 500) >= 500 && process.env.NODE_ENV === 'production' ? 'Server Error' : error.message || 'Server Error',
  });
};
