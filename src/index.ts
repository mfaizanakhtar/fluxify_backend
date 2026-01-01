import 'dotenv/config';
import buildServer from './server';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function main() {
  const server = await buildServer();
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server listening on ${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
