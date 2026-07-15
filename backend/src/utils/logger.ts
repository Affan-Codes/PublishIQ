import pino from 'pino';
import { env } from '../config/env.js';

const pinoOptions: any = {
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'password',
      'accessToken',
      'refreshToken',
      'clientSecret',
    ],
    remove: true,
  },
};

if (env.NODE_ENV === 'development') {
  pinoOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino(pinoOptions);
export default logger;
