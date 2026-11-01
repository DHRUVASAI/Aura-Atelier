import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.PUBLIC_URL || '',
].filter(Boolean);

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS allowlist'));
    }
  },
  credentials: true,
});

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https://pubchem.ncbi.nlm.nih.gov', 'https://generativelanguage.googleapis.com', 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://firestore.googleapis.com'],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

export const geminiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
});

export const logger = {
  info: (msg: string) => {
    // eslint-disable-next-line no-console
    console.log(`[Aura Atelier Info] ${new Date().toISOString()} - ${msg}`);
  },
  error: (msg: string, err?: unknown) => {
    // eslint-disable-next-line no-console
    console.error(`[Aura Atelier Error] ${new Date().toISOString()} - ${msg}`, err);
  },
};
