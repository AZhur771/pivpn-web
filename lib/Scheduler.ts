import { Repository } from 'typeorm';
import PiVPNWireGuard, { ClientStatus, piVPNWireGuard } from './PiVPNWireGuard';

import _debug from 'debug';
import { BannedClient } from './entities';
import { addDays, isAfter } from 'date-fns';
import { Datasource } from './Datasource';

const debug = _debug('Server');

export class Scheduler {
  private readonly TRAFFIC_LIMIT = 161061273600; // 150 GB
  private readonly LIMIT_MULTIPLIER = 5;

  constructor(
    private readonly wireguard: PiVPNWireGuard,
    private readonly bannedClientRepository: Repository<BannedClient>,
  ) {}

  public async invoke() {
    const today = new Date();

    debug(`Scheduler - check start: ${today.toISOString()}`);

    const clients = await this.wireguard.getClientsStatus();
    const bannedClients = await this.bannedClientRepository.find();

    let unbanned = 0;

    for (const bannedClient of bannedClients) {
      if (isAfter(today, bannedClient.bannedTill)) {
        await this.bannedClientRepository.delete(bannedClient.publicKey);

        const client = clients.find(client => client.publicKey === bannedClient.publicKey);
        if (client) {
          await this.wireguard.enableClient({ name: client.name });
        }

        unbanned++;
      }
    }

    debug(`Scheduler - check in progress - unbanned ${unbanned} clients`);

    const limitPerClient = Math.round((this.TRAFFIC_LIMIT / clients.length) * this.LIMIT_MULTIPLIER);

    debug(`Scheduler - check in progress - should check ${clients.length} clients - limit per client: ${limitPerClient} bytes`);

    let banned = 0;

    for (const client of clients.filter(client => client.enabled)) {
      const totalDownloaded = (client.transferRx ?? 0) + (client.transferTx ?? 0);
      if (totalDownloaded > limitPerClient) {
        await this.bannedClientRepository.save(this.createBannedClientEntity(client, totalDownloaded));
        await this.wireguard.disableClient({ name: client.name });

        banned++;
      }
    }

    debug(`Scheduler - check in progress - banned ${banned} clients`);

    debug(`Scheduler - check finish: ${new Date().toISOString()}`);
  }

  private createBannedClientEntity(client: ClientStatus, totalDownloaded: number): BannedClient {
    const bannedClient = new BannedClient();
    bannedClient.publicKey = client.publicKey;
    bannedClient.bannedTill = addDays(new Date(), 1);
    bannedClient.totalDownloaded = totalDownloaded;
    return bannedClient;
  }
}

export const scheduler = new Scheduler(piVPNWireGuard, Datasource.getRepository(BannedClient));
