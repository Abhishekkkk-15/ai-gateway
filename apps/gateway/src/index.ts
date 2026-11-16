import { buildServer } from './server.js';
import { loadConfig } from './config.js';

async function start() {
  const config = loadConfig();
  const app = await buildServer();

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`🚀 AI Gateway listening on http://${config.host}:${config.port}`);
  } catch (err) {
    console.error('Failed to start AI Gateway:', err);
    process.exit(1);
  }
}

void start();
