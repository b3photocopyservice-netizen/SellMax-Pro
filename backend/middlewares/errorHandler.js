function errorHandler(err, req, res, next) {
  console.error('API Error: ', err.stack || err.message);

  const status = err.status || 500;
  const message = err.message || 'An unexpected server error occurred.';

  res.status(status).json({
    error: message,
    // Include stack trace only in development
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

module.exports = errorHandler;
