import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/init.js';
import { setupRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

interface ListenError extends Error {
  code?: string;
}

dotenv.config();

const app: Express = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Initialize database
initializeDatabase();

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup routes
setupRoutes(app);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

const listenOnPort = (port: number) => {
  return new Promise<void>((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`🚀 SecureCode AI Backend rodando em http://localhost:${port}`);
      console.log(`📊 Dashboard disponível em http://localhost:5173`);
      resolve();
    });

    server.on('error', (error: Error) => {
      reject(error);
    });
  });
};

const startServer = async () => {
  const basePort = parseInt(process.env.PORT || '3000', 10);
  const ports = [basePort, basePort + 1, basePort + 2];

  for (const port of ports) {
    try {
      await listenOnPort(port);
      return;
    } catch (error: unknown) {
      const listenError = error as ListenError;
      if (listenError.code === 'EADDRINUSE') {
        console.warn(`Porta ${port} ocupada, tentando próxima porta...`);
        continue;
      }
      console.error('Erro ao iniciar o servidor:', error);
      process.exit(1);
    }
  }

  console.error('Nenhuma porta disponível encontrada. Verifique os processos em execução.');
  process.exit(1);
};

startServer();

export default app;
