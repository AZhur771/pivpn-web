const debug = require('debug')('SSH');
const { NodeSSH } = require('node-ssh');

const {
  SSH_PORT,
  SSH_HOST,
  SSH_USER,
  SSH_PASSWORD,
} = require('../config');

module.exports = class SSH {
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

  async connect() {
    debug(`Connecting to ${this.host}:${this.port}...`);

    await this.ssh.connect({
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
    });
  }

  async exec(command) {
    const {
      stdout,
      stderr,
    } = await this.ssh.execCommand(command);

    return {
      stdout,
      stderr,
    };
  }

  destroy() {
    this.ssh.dispose();
  }
};
