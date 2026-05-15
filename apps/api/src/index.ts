import { config } from './config.js';
import { buildServer } from './server.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/db.js';

async function main() {
  const server = await buildServer();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    try {
      await server.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await server.listen({ port: config.API_PORT, host: config.API_HOST });
    logger.info(
      { port: config.API_PORT, host: config.API_HOST, env: config.NODE_ENV },
      'API ready',
    );
  } catch (err) {
    logger.error({ err }, 'failed to start');
    process.exit(1);
  }
}

void main();
