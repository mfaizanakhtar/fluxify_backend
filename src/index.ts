import 'dotenv/config';
import buildServer from './server';
import { initializeJobQueue, stopJobQueue } from './queue/jobQueue';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function main() {
  // Initialize job queue for API process
  await initializeJobQueue();
  console.log('[API] Job queue initialized');

  const server = await buildServer();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[API] Shutting down...');
    await server.close();
    await stopJobQueue();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('[API] Shutting down...');
    await server.close();
    await stopJobQueue();
    process.exit(0);
  });

  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[API] Server listening on ${PORT}`);
  } catch (err) {
    server.log.error(err);
    await stopJobQueue();
    process.exit(1);
  }
}

main();
