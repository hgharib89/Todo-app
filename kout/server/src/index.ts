import { startServer } from './app';
import { log } from './log';

const port = Number(process.env.PORT ?? 2567);
startServer(port).catch((e) => {
  log('error', 'server_failed', { error: String(e) });
  process.exit(1);
});
