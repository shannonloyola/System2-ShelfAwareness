export const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const createHttpError = (status, message, details) => {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
};
