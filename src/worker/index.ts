import 'dotenv/config';
import { startBoss } from '../queue/pgBoss';
import { handleProvision } from './jobs/provisionEsim';

async function run() {
  const boss = await startBoss();
  console.log('pg-boss started');

  // Register worker for provision_esim
  await boss.work('provision_esim', async (job: unknown) => {
    const j = job as Record<string, unknown>;
    const jobId = j.id ? String(j.id) : 'unknown';
    const jobData = (j.data as Record<string, unknown>) || {};
    console.log('processing job', jobId, jobData);
    try {
      await handleProvision(jobData);
      await boss.complete(jobId);
      console.log('job completed', jobId);
    } catch (err) {
      console.error('job failed', jobId, err);
      // let pg-boss handle retries by rethrowing
      throw err;
    }
  });

  // graceful shutdown
  process.on('SIGINT', async () => {
    console.log('shutting down worker');
    await boss.stop();
    process.exit(0);
  });
}

run().catch((err) => {
  console.error('worker error', err);
  process.exit(1);
});
