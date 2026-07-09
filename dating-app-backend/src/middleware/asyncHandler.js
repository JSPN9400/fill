// Express 4 does NOT automatically catch errors thrown inside async route handlers —
// an unhandled rejection there crashes the whole Node process. Wrapping every async
// controller with this sends the error to next(err) -> our central error handler instead.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
