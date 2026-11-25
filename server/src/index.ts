import pino from 'pino';
import { env } from './config/env.js';
import { createApp } from './app.js';

const logger = pino({ name: 'soundsphere-api' });
const { app, repo } = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, storage: repo.kind }, 'SoundSphere API listening');
});

function shutdown() {
  logger.info('Shutting down SoundSphere API');
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

