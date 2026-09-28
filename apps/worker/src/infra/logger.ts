import pino from 'pino';

const development = (process.env.NODE_ENV ?? 'development') !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (development ? 'debug' : 'info'),
  base: {
    service: 'felipe-almeida-developer-worker',
    ambiente: process.env.NODE_ENV ?? 'development',
  },
  redact: {
    paths: ['password', '*.password', 'authorization', '*.authorization', 'accessToken', '*.accessToken'],
    censor: '[REMOVIDO]',
  },
  transport: development
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', singleLine: true },
      }
    : undefined,
});
