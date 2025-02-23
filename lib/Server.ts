import path from 'path';

import express from 'express';
import expressSession from 'express-session';
import helmet from 'helmet';
import morgan from 'morgan';
import _debug from 'debug';

import Util from './Util';
import PiVPNWireGuard, { piVPNWireGuard } from './PiVPNWireGuard';
import ServerError from './ServerError';

import { PORT, ADMIN_USER, ADMIN_PASSWORD, SSH_USER } from './config';

const debug = _debug('Server');

interface Session {
  username: string;
  hostname: string;
}

export class Server {
  private sessions: Record<string, Session> = {};

  constructor(private readonly wireguard: PiVPNWireGuard) {}

  public async init(): Promise<void> {
    // Express
    express()
      .use(helmet({
        contentSecurityPolicy: {
          directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            'script-src': [
              '\'self\'',
              '\'unsafe-eval\'',
              'https://cdn.jsdelivr.net/',
            ],
          },
        },
      }))
      .use('/', express.static(path.join(__dirname, '..', 'www')))
      .use(express.json())
      .use(morgan(':method :url :status - :response-time ms'))
      .set('trust proxy', 1)
      .use(expressSession({
        secret: process.env.SECRET ?? String(Math.random()),
        resave: true,
        saveUninitialized: true,
        cookie: {
          sameSite: 'strict',
          httpOnly: true,
          secure: !!process.env.IS_SECURE,
        },
      }))

      // Authentication
      .get('/api/session', Util.promisify(async (req) => {
        const session = this.sessions[req.session.id];
        if (session) {
          return {
            authenticated: true,
            username: session.username,
            hostname: session.hostname,
          };
        }
        return {
          authenticated: false,
        };
      }))
      .post('/api/session', Util.promisify(async (req) => {
        const {
          username,
          password,
        } = req.body;

        if (!username) {
          throw new Error('Missing username');
        }

        if (!password) {
          throw new Error('Missing password');
        }

        if (username !== ADMIN_USER) {
          throw new Error('Wrong username or password');
        }

        if (password !== ADMIN_PASSWORD) {
          throw new Error('Wrong username or password');
        }

        const hostname = await this.wireguard.getHostname();

        this.sessions[req.session.id] = {
          username: SSH_USER ?? '',
          hostname,
        };

        req.session.save();
        debug(`New Session for ${username}: ${SSH_USER}@${hostname} (${req.session.id})`);
      }))
      .delete('/api/session', Util.promisify(async (req) => {
        this.validateSession(req.session.id);

        const { username, hostname } = this.sessions[req.session.id];

        req.session.destroy((err) => {
          debug(err);
        });

        debug(`Deleted Session for ${username}: ${SSH_USER}@${hostname}`);
      }))

      // WireGuard
      .get('/api/wireguard/client', Util.promisify(async (req) => {
        this.validateSession(req.session.id);
        return await this.wireguard.getClients();
      }))
      .get('/api/wireguard/client-status', Util.promisify(async (req) => {
        this.validateSession(req.session.id);
        return await this.wireguard.getClientsStatus();
      }))
      .get('/api/wireguard/client/:name', Util.promisify(async (req) => {
        const { name } = req.params;
        this.validateSession(req.session.id);
        return await this.wireguard.getClient({ name });
      }))
      .get('/api/wireguard/client/:name/qrcode.svg', Util.promisify(async (req, res) => {
        const { name } = req.params;
        this.validateSession(req.session.id);
        const svg = await this.wireguard.getClientQRCodeSVG({ name });
        res.header('Content-Type', 'image/svg+xml');
        res.send(svg);
      }))
      .get('/api/wireguard/client/:name/configuration', Util.promisify(async (req, res) => {
        const { name } = req.params;
        this.validateSession(req.session.id);
        const configuration = await this.wireguard.getClientConfiguration({ name });
        res.header('Content-Disposition', `attachment; filename="${name}.conf"`);
        res.header('Content-Type', 'text/plain');
        res.send(configuration);
      }))
      .post('/api/wireguard/client/:name', Util.promisify(async (req) => {
        const { name } = req.params;
        this.validateSession(req.session.id);
        return await this.wireguard.createClient({ name });
      }))
      .delete('/api/wireguard/client/:name', Util.promisify(async (req) => {
        const { name } = req.params;
        this.validateSession(req.session.id);
        return await this.wireguard.deleteClient({ name });
      }))
      .post('/api/wireguard/client/:name/enable', Util.promisify(async (req) => {
        const { name } = req.params;
        this.validateSession(req.session.id);
        return await this.wireguard.enableClient({ name });
      }))
      .post('/api/wireguard/client/:name/disable', Util.promisify(async (req) => {
        const { name } = req.params;
        this.validateSession(req.session.id);
        return await this.wireguard.disableClient({ name });
      }))

      // Start the server
      .listen(PORT, () => {
        debug(`Listening on http://localhost:${PORT}`);
      });
  }

  private validateSession(sessionId: string): void {
    const session = this.sessions[sessionId];
    if (!session) {
      throw new ServerError(`Invalid Session: ${sessionId}`, 401);
    }
  }
}

export const server = new Server(piVPNWireGuard);
