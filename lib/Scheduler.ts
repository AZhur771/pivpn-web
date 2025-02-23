import PiVPNWireGuard, { piVPNWireGuard } from './PiVPNWireGuard';

import _debug from 'debug';

const debug = _debug('Server');

export class Scheduler {
  private readonly TRAFFIC_LIMIT = 161061273600; // 150 GB
  private readonly LIMIT_MULTIPLIER = 5;

  constructor(private readonly wireguard: PiVPNWireGuard) {}

  public async invoke() {
    const clients = await this.wireguard.getClientsStatus();

    const limitPerClient = (this.TRAFFIC_LIMIT / clients.length) * this.LIMIT_MULTIPLIER;

    debug(`Scheduler - check ${clients.length} clients - limit per client: ${limitPerClient}`);

    for (const client of clients.filter(client => client.enabled)) {
      const totalDownloaded = (client.transferRx ?? 0) + (client.transferTx ?? 0);
      if (totalDownloaded > limitPerClient) {
        await this.wireguard.disableClient({ name: client.name });
      }
    }
  }
}

export const scheduler = new Scheduler(piVPNWireGuard);
