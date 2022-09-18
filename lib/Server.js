'use strict';

const path = require('path');

const express = require('express');
const expressSession = require('express-session');
const helmet = require("helmet");
const debug = require('debug')('Server');

const Util = require('./Util');
const SSH = require('./SSH');
const PiVPNWireGuard = require('./PiVPNWireGuard');
const ServerError = require('./ServerError');

const {
  PORT,
  ADMIN_USER,
  ADMIN_PASSWORD,
} = require('../config');

module.exports = class Server {

  constructor() {
    // Sessions
    this.sessions = {};

    // Express
    this.app = express()
      .use(helmet({
        contentSecurityPolicy: {
          directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": [
                "'self'",
                "'unsafe-eval'",
                "https://cdn.jsdelivr.net/"
            ],
          },
        },
      }))
      .use('/', express.static(path.join(__dirname, '..', 'www')))
      .use(express.json())
      .use(expressSession({
        secret: String(Math.random()),
        resave: true,
        saveUninitialized: true,
        cookie: { sameSite: 'strict' },
      }))

      // Authentication
      .get('/api/session', Util.promisify(async req => {
        const session = this.sessions[req.session.id];
        if( session ) {
          return {
            authenticated: true,
            username: session.username,
            hostname: session.hostname,
          };
        } else {
          return {
            authenticated: false,
          };
        }
      }))
      .post('/api/session', Util.promisify(async req => {
        const {
          username,
          password,
        } = req.body

        if( !username ) {
          throw new Error('Missing username');
        }

        if( !password ) {
          throw new Error('Missing password');
        }

        if( username !== ADMIN_USER ) {
          throw new Error('Wrong username or password');
        }

        if( password !== ADMIN_PASSWORD ) {
          throw new Error('Wrong username or password');
        }

        const ssh = new SSH();
        await ssh.connect();
        const { stdout: hostname } = await ssh.exec('hostname');

        const wireguard = new PiVPNWireGuard({ ssh });

        this.sessions[req.session.id] = {
          ssh,
          wireguard,
          username,
          hostname,
        };

        req.session.save();
        debug(`New Session: ${username}@${hostname} (${req.session.id})`);
      }))
      .delete('/api/session', Util.promisify(async req => {
        const session = this.getSession(req.session.id);

        session.wireguard.destroy();
        session.ssh.destroy()
        req.session.destroy();

        debug(`Deleted Session: ${session.username}@${session.hostname}`);
      }))
    
      // WireGuard
      .get('/api/wireguard/client', Util.promisify(async req => {
        const { wireguard } = this.getSession(req.session.id);
        return wireguard.getClients();
      }))
      .get('/api/wireguard/client-status', Util.promisify(async req => {
        const { wireguard } = this.getSession(req.session.id);
        return wireguard.getClientsStatus();
      }))
      .get('/api/wireguard/client/:name', Util.promisify(async req => {
        const { name } = req.params;
        const { wireguard } = this.getSession(req.session.id);
        return wireguard.getClient({ name });
      }))
      .get('/api/wireguard/client/:name/qrcode.svg', Util.promisify(async (req, res) => {
        const { name } = req.params;
        const { wireguard } = this.getSession(req.session.id);
        const svg = await wireguard.getClientQRCodeSVG({ name });
        res.header('Content-Type', 'image/svg+xml');
        res.send(svg);
      }))
      .get('/api/wireguard/client/:name/configuration', Util.promisify(async (req, res) => {
        const { name } = req.params;
        const { wireguard } = this.getSession(req.session.id);
        const configuration = await wireguard.getClientConfiguration({ name });
        res.header('Content-Disposition', `attachment; filename="${name}.conf"`);
        res.header('Content-Type', 'text/plain');
        res.send(configuration);
      }))
      .post('/api/wireguard/client/:name', Util.promisify(async req => {
        const { name } = req.params;
        const { wireguard } = this.getSession(req.session.id);
        return wireguard.createClient({ name });
      }))
      .delete('/api/wireguard/client/:name', Util.promisify(async req => {
        const { name } = req.params;
        const { wireguard } = this.getSession(req.session.id);
        return wireguard.deleteClient({ name });
      }))
      .post('/api/wireguard/client/:name/enable', Util.promisify(async req => {
        const { name } = req.params;
        const { wireguard } = this.getSession(req.session.id);
        return wireguard.enableClient({ name });
      }))
      .post('/api/wireguard/client/:name/disable', Util.promisify(async req => {
        const { name } = req.params;
        const { wireguard } = this.getSession(req.session.id);
        return wireguard.disableClient({ name });
      }))

      // Start the server
      .listen(PORT, () => {
        debug(`Listening on http://localhost:${PORT}`);
      });
  }

  getSession(sessionId) {
    const session = this.sessions[sessionId];
    if( !session ) {
      throw new ServerError(`Invalid Session: ${sessionId}`, 401);
    }

    return session;
  }

}
