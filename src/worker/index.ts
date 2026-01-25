import 'dotenv/config';
import { initializeJobQueue, stopJobQueue } from '../queue/jobQueue';
import { handleProvision } from './jobs/provisionEsim';

async function run() {
  console.log('[Worker] Starting worker process...');

  const boss = await initializeJobQueue();

  // Register worker for provision-esim jobs
  await boss.work('provision-esim', { teamSize: 5, teamConcurrency: 2 }, async (job: unknown) => {
    const j = job as Record<string, unknown>;
    const jobId = j.id ? String(j.id) : 'unknown';
    const jobData = (j.data as Record<string, unknown>) || {};

    console.log(`[Worker] Processing job ${jobId}`);

    try {
      await handleProvision(jobData);
      console.log(`[Worker] Job ${jobId} completed successfully`);
    } catch (err) {
      console.error(`[Worker] Job ${jobId} failed:`, err);
      // Re-throw to let pg-boss handle retries
      throw err;
    }
  });

  console.log('[Worker] Worker registered and ready to process jobs');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[Worker] Shutting down worker...');
    await stopJobQueue();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('[Worker] Shutting down worker...');
    await stopJobQueue();
    process.exit(0);
  });
}

run().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
