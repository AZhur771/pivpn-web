module.exports = class Util {
  static promisify(fn) {
    return (req, res) => {
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
        .catch((e) => {
          let error;

          if (typeof e === 'string') {
            error = new Error(e);
          } else {
            error = e;
          }

          return res
            .status(error.statusCode || 500)
            .json({
              error: error.message || error.toString(),
              stack: error.stack,
            });
        });
    };
  }
};
