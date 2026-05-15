import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  PREDICTOR_URL: z.string().url().default('http://localhost:8000'),
  PREDICTOR_TIMEOUT_MS: z.coerce.number().int().min(100).default(2000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
});

export type Env = z.infer<typeof envSchema>;

function loadConfig(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      // eslint-disable-next-line no-console
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

export const config = loadConfig();
export const isProd = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
