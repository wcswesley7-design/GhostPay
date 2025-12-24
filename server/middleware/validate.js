const { ZodError } = require('zod');

function buildErrorResponse(error) {
  if (error instanceof ZodError) {
    return {
      error: 'Invalid request',
      details: error.flatten()
    };
  }

  return {
    error: 'Invalid request'
  };
}

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(buildErrorResponse(result.error));
    }

    req.body = result.data;
    return next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json(buildErrorResponse(result.error));
    }

    req.query = result.data;
    return next();
  };
}

module.exports = {
  validateBody,
  validateQuery
};
