import { pino } from 'pino';
import { config, isProd } from '../config.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
        },
      }),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
    censor: '[redacted]',
  },
});
