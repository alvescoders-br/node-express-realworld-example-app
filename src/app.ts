import express from 'express';
import cors from 'cors';
import * as bodyParser from 'body-parser';
import routes from './app/routes/routes';
import HttpException from './app/models/http-exception.model';

const app = express();

type UnauthorizedError = Error & { name: 'UnauthorizedError' };

const isUnauthorizedError = (err: Error | HttpException): err is UnauthorizedError =>
  err.name === 'UnauthorizedError';

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(routes);

// Serves images
app.use(express.static(__dirname + '/assets'));

app.get('/', (req: express.Request, res: express.Response) => {
  res.json({ status: 'API is running on /api' });
});

app.use(
  (
    err: Error | HttpException,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    void next;

    if (isUnauthorizedError(err)) {
      return res.status(401).json({
        status: 'error',
        message: 'missing authorization credentials',
      });
    }

    if (err instanceof HttpException) {
      return res.status(err.errorCode).json(err.response);
    }

    if (err) {
      return res.status(500).json(err.message);
    }
  },
);

export default app;
