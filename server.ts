import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { corsMiddleware, helmetMiddleware, geminiRateLimiter, logger } from './server/middleware';
import geminiRouter from './server/routes/gemini';
import scienceRouter from './server/routes/science';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));
app.use(corsMiddleware);
app.use(helmetMiddleware);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Aura Atelier Engine' });
});

// Mount routes with rate limiter on Gemini API
app.use('/api/gemini', geminiRateLimiter, geminiRouter);
app.use('/api/science', scienceRouter);

async function startServer() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VITEST && process.env.NODE_ENV !== 'test') {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err: unknown) {
      logger.error('Vite middleware setup warning', err);
    }
  } else if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
    try {
      const server = app.listen(PORT, '0.0.0.0', () => {
        logger.info(`Aura Atelier server listening on http://localhost:${PORT}`);
      });
      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          logger.info(`Port ${PORT} is already bound; proceeding.`);
        } else {
          logger.error('Server listen error', err);
        }
      });
    } catch (err: unknown) {
      logger.info(`Server listen note: port ${PORT} may be managed by container host.`);
    }
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export { app };
export default app;
