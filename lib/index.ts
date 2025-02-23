import cron from 'node-cron';

import { server } from './Server';
import { scheduler } from './Scheduler';

const EVERY_30_MINUTES_CRON = '*/30 * * * *';

server.init().catch(console.error);
cron.schedule(EVERY_30_MINUTES_CRON, scheduler.invoke);
