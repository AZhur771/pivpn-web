const QRCode = require('qrcode');

module.exports = class PiVPNWireGuard {
  constructor({ ssh }) {
    this.ssh = ssh;
  }

  // eslint-disable-next-line class-methods-use-this
  sanitizeName(name) {
    const regex = /[^a-z0-9 .,_-]/gim;
    const found = name.match(regex);

    if (found) {
      throw new Error(`Invalid Client Name: ${name}`);
    }
  }

  async getClients() {
    const { stdout } = await this.ssh.exec('sudo cat /etc/wireguard/configs/clients.txt');
    return stdout
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => {
        const [name, publicKey, createdAt] = line.split(' ');
        return {
          name,
          publicKey,
          createdAt: new Date(Number(`${createdAt}000`)),
        };
      });
  }

  async getClientsStatus() {
    const clients = await this.getClients();
    const { stdout: clientsDump } = await this.ssh.exec('sudo wg show all dump');
    const { stdout: wg0Config } = await this.ssh.exec('sudo cat /etc/wireguard/wg0.conf');

    const result = [];

    // Loop clients
    clients.forEach((client) => {
      result.push({
        name: client.name,
        publicKey: client.publicKey,
        createdAt: client.createdAt,
        enabled: wg0Config.includes(`#[disabled] ### begin ${client.name} ###`) === false,
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

        const client = result.find((cl) => cl.publicKey === publicKey);
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

  async getClient({ name }) {
    const clients = await this.getClients();
    const client = clients.find((cl) => cl.name === name);

    if (!client) {
      throw new Error(`Invalid Client: ${name}`);
    }

    return client;
  }

  async getClientConfiguration({ name }) {
    await this.getClient({ name });
    const { stdout } = await this.ssh.exec(`sudo cat /etc/wireguard/configs/${name}.conf`);
    return stdout;
  }

  async getClientQRCodeSVG({ name }) {
    const configuration = await this.getClientConfiguration({ name });
    return QRCode.toString(configuration, {
      type: 'svg',
      width: 512,
    });
  }

  async createClient({ name }) {
    this.sanitizeName(name);

    if (!name) {
      throw new Error('Missing: Name');
    }

    try {
      await this.getClient({ name });
      throw new Error(`Duplicate Client: ${name}`);
    } catch (err) {
      if (err.message.startsWith('Duplicate Client')) {
        throw err;
      }
    }

    await this.ssh.exec(`pivpn add -n ${name}`);

    return this.getClient({ name });
  }

  async deleteClient({ name }) {
    if (!name) {
      throw new Error('Missing: Name');
    }

    const client = await this.getClient({ name });
    await this.ssh.exec(`pivpn remove --yes ${name}`);
    return client;
  }

  async enableClient({ name }) {
    if (!name) {
      throw new Error('Missing: Name');
    }

    const client = await this.getClient({ name });
    await this.ssh.exec(`pivpn on --yes ${name}`);
    return client;
  }

  async disableClient({ name }) {
    if (!name) {
      throw new Error('Missing: Name');
    }

    const client = await this.getClient({ name });
    await this.ssh.exec(`pivpn off --yes ${name}`);
    return client;
  }

  destroy() {
    this.ssh.destroy();
  }
};
