import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4 never forwards a rejected promise from an async route handler to
// its error middleware - the rejection becomes an unhandled promise
// rejection at the process level, which crashes the entire server (taking
// down every user's session, not just the one bad request). Wrapping every
// handler with this ensures a thrown/rejected error always reaches
// next(err) and gets a clean 500 response instead.
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
