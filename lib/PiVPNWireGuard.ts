import QRCode from 'qrcode';
import { ssh, SSH } from './SSH';

interface Client {
  name: string;
  publicKey: string;
  createdAt: Date;
}

interface ClientStatus extends Client {
  iface?: string;
  preSharedKey?: string;
  enabled: boolean;
  endpoint?: string | null;
  allowedIps?: string;
  latestHandshake?: Date | null;
  transferRx?: number;
  transferTx?: number;
  persistentKeepalive?: string;
}

export default class PiVPNWireGuard {
  constructor(private readonly ssh: SSH) {}

  private sanitizeName(name: string): void {
    const regex = /[^a-z0-9 .,_-]/gim;
    const found = name.match(regex);

    if (found) {
      throw new Error(`Invalid Client Name: ${name}`);
    }
  }

  public async getClients(): Promise<Client[]> {
    const { stdout } = await this.ssh.exec('sudo cat /etc/wireguard/configs/clients.txt');
    return stdout
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map((line) => {
        const [name, publicKey, createdAt] = line.split(' ');
        return {
          name,
          publicKey,
          createdAt: new Date(Number(`${createdAt}000`)),
        };
      });
  }

  public async getClientsStatus(): Promise<ClientStatus[]> {
    const clients = await this.getClients();
    const { stdout: clientsDump } = await this.ssh.exec('sudo wg show all dump');
    const { stdout: wg0Config } = await this.ssh.exec('sudo cat /etc/wireguard/wg0.conf');

    const result: ClientStatus[] = [];

    // Loop clients
    clients.forEach((client) => {
      result.push({
        name: client.name,
        publicKey: client.publicKey,
        createdAt: client.createdAt,
        enabled: !wg0Config.includes(`#[disabled] ### begin ${client.name} ###`),
      });
    });

    // Loop WireGuard status
    clientsDump
      .trim()
      .split('\n')
      .slice(1)
      .forEach((line) => {
        const [
          iface,
          publicKey,
          preSharedKey,
          endpoint,
          allowedIps,
          latestHandshake,
          transferRx,
          transferTx,
          persistentKeepalive,
        ] = line.split('\t');

        const client = result.find(cl => cl.publicKey === publicKey);
        if (!client) return;

        client.iface = iface;
        client.preSharedKey = preSharedKey;
        client.endpoint = endpoint === '(none)'
          ? null
          : endpoint;
        client.allowedIps = allowedIps;
        client.latestHandshake = latestHandshake === '0'
          ? null
          : new Date(Number(`${latestHandshake}000`));
        client.transferRx = Number(transferRx);
        client.transferTx = Number(transferTx);
        client.persistentKeepalive = persistentKeepalive;
      });

    return result;
  }

  public async getHostname(): Promise<string> {
    const { stdout: hostname } = await this.ssh.exec('hostname');
    return hostname;
  }

  public async getClient({ name }: { name: string }): Promise<Client> {
    const clients = await this.getClients();
    const client = clients.find(cl => cl.name === name);

    if (!client) {
      throw new Error(`Invalid Client: ${name}`);
    }

    return client;
  }

  public async getClientConfiguration({ name }: { name: string }): Promise<string> {
    await this.getClient({ name });
    const { stdout } = await this.ssh.exec(`sudo cat /etc/wireguard/configs/${name}.conf`);
    return stdout;
  }

  public async getClientQRCodeSVG({ name }: { name: string }): Promise<string> {
    const configuration = await this.getClientConfiguration({ name });
    return await QRCode.toString(configuration, {
      type: 'svg',
      width: 512,
    });
  }

  public async createClient({ name }: { name: string }): Promise<Client> {
    this.sanitizeName(name);

    if (!name) {
      throw new Error('Missing: Name');
    }

    try {
      await this.getClient({ name });
      throw new Error(`Duplicate Client: ${name}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catch (err: any) {
      if (err.message.startsWith('Duplicate Client')) {
        throw err;
      }
    }

    await this.ssh.exec(`pivpn add -n ${name}`);

    return await this.getClient({ name });
  }

  public async deleteClient({ name }: { name: string }): Promise<Client> {
    if (!name) {
      throw new Error('Missing: Name');
    }

    const client = await this.getClient({ name });
    await this.ssh.exec(`pivpn remove --yes ${name}`);
    return client;
  }

  public async enableClient({ name }: { name: string }): Promise<Client> {
    if (!name) {
      throw new Error('Missing: Name');
    }

    const client = await this.getClient({ name });
    await this.ssh.exec(`pivpn on --yes ${name}`);
    return client;
  }

  public async disableClient({ name }: { name: string }): Promise<Client> {
    if (!name) {
      throw new Error('Missing: Name');
    }

    const client = await this.getClient({ name });
    await this.ssh.exec(`pivpn off --yes ${name}`);
    return client;
  }

  public destroy(): void {
    this.ssh.destroy();
  }
};

export const piVPNWireGuard = new PiVPNWireGuard(ssh);
