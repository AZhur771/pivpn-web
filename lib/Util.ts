import type { Request, Response } from 'express';
import ServerError from './ServerError';

export default class Util {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static promisify(fn: (req: Request, res: Response) => any) {
    return (req: Request, res: Response) => {
      Promise.resolve().then(async () => fn(req, res))
        .then((result) => {
          if (res.headersSent) return;

          if (typeof result === 'undefined') {
            res
              .status(204)
              .end();

            return;
          }

          res
            .status(200)
            .json(result);
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((e: any) => {
          let error: Error;

          if (typeof e === 'string') {
            error = new Error(e);
          } else {
            error = e;
          }

          const status = error instanceof ServerError ? error.getStatusCode() : 500;

          return res
            .status(status)
            .json({
              error: error.message || error.toString(),
              stack: error.stack,
            });
        });
    };
  }
}
