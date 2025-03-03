import path from 'path';

import express from 'express';
import expressSession from 'express-session';
import { DataSource as TypeormDataSource } from 'typeorm';
import helmet from 'helmet';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import cron from 'node-cron';

import Util from './Util';
import PiVPNWireGuard, { piVPNWireGuard } from './PiVPNWireGuard';
import { scheduler } from './Scheduler';
import ServerError from './ServerError';

import { PORT, SSH_USER } from '../config';
import { TypeormStore } from 'typeorm-store';
import { Datasource } from './Datasource';
import { Session, User } from './entities';
import { lock, Lock } from './Lock';

import _debug from 'debug';

const debug = _debug('Server');

const EVERY_10_MINUTES_CRON = '*/1 * * * *';

interface SessionInfo {
  username: string;
  hostname: string;
  isAdmin: boolean;
}

declare module 'express-session' {
  interface SessionData {
    _info: SessionInfo;
  }
}

export class Server {
  constructor(
    private readonly wireguard: PiVPNWireGuard,
    private readonly datasource: TypeormDataSource,
    private readonly lock: Lock,
  ) {}

  private async initDatasource(): Promise<void> {
    await this.datasource.initialize();
  }

  private async initServer(): Promise<void> {
    // Express server
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
        store: new TypeormStore({ repository: this.datasource.getRepository(Session) }),
      }))

    // Authentication
      .get('/api/session', Util.promisify(async (req) => {
        const sessionInfo = req.session._info;
        if (sessionInfo) {
          return {
            authenticated: true,
            username: sessionInfo.username,
            hostname: sessionInfo.hostname,
            isAdmin: sessionInfo.isAdmin,
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

        const user = await this.datasource.getRepository(User).findOneBy({ login: username });

        if (!user) {
          throw new Error('Wrong username or password');
        }

        if (!await bcrypt.compare(password, user.password)) {
          throw new Error('Wrong username or password');
        }

        const hostname = await this.wireguard.getHostname();

        req.session._info = {
          username: SSH_USER ?? '',
          hostname,
          isAdmin: user.admin,
        };

        req.session.save();
        debug(`New Session for ${username}: ${SSH_USER}@${hostname} (${req.session.id})`);
      }))
      .delete('/api/session', Util.promisify(async (req) => {
        const { username, hostname } = this.validateSession(req.session);

        req.session.destroy((err) => {
          if (err) {
            debug(err);
          }
        });

        debug(`Deleted Session for ${username}: ${SSH_USER}@${hostname}`);
      }))

    // WireGuard
      .get('/api/wireguard/client', Util.promisify(async (req) => {
        this.validateSession(req.session);
        return await this.wireguard.getClients();
      }))
      .get('/api/wireguard/client-status', Util.promisify(async (req) => {
        this.validateSession(req.session);
        return await this.wireguard.getClientsStatus();
      }))
      .get('/api/wireguard/client/:name', Util.promisify(async (req) => {
        const { name } = req.params;
        this.validateSession(req.session);
        return await this.wireguard.getClient({ name });
      }))
      .get('/api/wireguard/client/:name/qrcode.svg', Util.promisify(async (req, res) => {
        const { name } = req.params;
        this.validateSession(req.session);
        const svg = await this.wireguard.getClientQRCodeSVG({ name });
        res.header('Content-Type', 'image/svg+xml');
        res.send(svg);
      }))
      .get('/api/wireguard/client/:name/configuration', Util.promisify(async (req, res) => {
        const { name } = req.params;
        this.validateSession(req.session);
        const configuration = await this.wireguard.getClientConfiguration({ name });
        res.header('Content-Disposition', `attachment; filename="${name}.conf"`);
        res.header('Content-Type', 'text/plain');
        res.send(configuration);
      }))
      .post('/api/wireguard/client/:name', Util.promisify(async (req) => {
        const { name } = req.params;
        this.validateSession(req.session, true);
        return await this.wireguard.createClient({ name });
      }))
      .delete('/api/wireguard/client/:name', Util.promisify(async (req) => {
        const { name } = req.params;
        this.validateSession(req.session, true);
        return await this.wireguard.deleteClient({ name });
      }))
      .post('/api/wireguard/client/:name/enable', Util.promisify(async (req) => {
        const { name } = req.params;
        this.validateSession(req.session, true);
        return await this.wireguard.enableClient({ name });
      }))
      .post('/api/wireguard/client/:name/disable', Util.promisify(async (req) => {
        const { name } = req.params;
        this.validateSession(req.session, true);
        return await this.wireguard.disableClient({ name });
      }))

    // Start the server
      .listen(PORT, () => {
        debug(`Listening on http://localhost:${PORT}`);
      });
  }

  private async initScheduler(): Promise<void> {
    // Scheduler
    cron.schedule(EVERY_10_MINUTES_CRON, () => {
      this.lock.acquireAndExecute({ name: 'client-check' }, async () => {
        scheduler.invoke().catch(console.error);
      });
    });
  }

  public async init(): Promise<void> {
    await this.initDatasource();
    await this.initScheduler();
    await this.initServer();
  }

  private validateSession(
    session: expressSession.Session & Partial<expressSession.SessionData>,
    checkAdminPrivilege = false,
  ): SessionInfo {
    const sessionInfo = session._info;
    if (!sessionInfo) {
      throw new ServerError(`Invalid Session: ${session.id}`, 401);
    }

    if (checkAdminPrivilege && !sessionInfo.isAdmin) {
      throw new ServerError('Not enough rights', 403);
    }

    return sessionInfo;
  }
}

export const server = new Server(piVPNWireGuard, Datasource, lock);
