export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Gemini API specific errors
  if (err.status === 400) {
    return res.status(400).json({
      error: 'Invalid request to Gemini API',
      message: err.message
    });
  }

  if (err.status === 429) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.'
    });
  }

  if (err.status === 403 || err.message?.includes('API key')) {
    return res.status(401).json({
      error: 'Invalid API key',
      message: 'Please check your GEMINI_API_KEY in the .env file'
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Something went wrong'
  });
};
