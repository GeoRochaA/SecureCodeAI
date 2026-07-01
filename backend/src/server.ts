import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from './database/init.js';
import { setupRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app: Express = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));

// Rate limit: 50 requisições / 15 min por IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

setupRoutes(app);
app.use(errorHandler);
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

const startServer = async () => {
  await initializeDatabase();

  const port = 3000;
  app.listen(port, () => {
    console.log(`\n✅ SecureCode Scanner: http://localhost:${port}\n`);
  });
};

startServer();
