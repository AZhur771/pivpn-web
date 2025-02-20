import { NodeSSH } from 'node-ssh';
import _debug from 'debug';

import { SSH_PORT, SSH_HOST, SSH_USER, SSH_PASSWORD } from './config';

const debug = _debug('SSH');

export default class SSH {
  private readonly ssh: NodeSSH;
  private readonly host: string;
  private readonly port: number;
  private readonly username: string;
  private readonly password: string;

  constructor() {
    if (!SSH_HOST) {
      throw new Error('Missing: Host');
    }

    if (!SSH_PORT) {
      throw new Error('Missing: Port');
    }

    if (!SSH_USER) {
      throw new Error('Missing: Username');
    }

    if (!SSH_PASSWORD) {
      throw new Error('Missing: Password');
    }

    this.ssh = new NodeSSH();
    this.host = SSH_HOST;
    this.port = SSH_PORT;
    this.username = SSH_USER;
    this.password = SSH_PASSWORD;
  }

  public async exec(command: string): Promise<{ stdout: string; stderr: string }> {
    if (!this.ssh.isConnected()) {
      await this.connect();
    }

    const {
      stdout,
      stderr,
    } = await this.ssh.execCommand(command);

    return {
      stdout,
      stderr,
    };
  }

  private async connect(): Promise<void> {
    debug(`Connecting to ${this.host}:${this.port}...`);

    await this.ssh.connect({
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
    });
  }

  public destroy(): void {
    this.ssh.dispose();
  }
};
