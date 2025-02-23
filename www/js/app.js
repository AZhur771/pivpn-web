'use strict';

// App
new Vue({
  el: '#app',
  data: {
    appInitialized: false,

    authenticated: null,
    authenticating: false,

    username: null,
    password: null,

    clients: null,
    clientDelete: null,
    clientCreate: null,
    clientCreateName: '',
    qrcode: null,

    totalDownloaded: 0,
    totalUploaded: 0,

    limitPerClient: 0,
  },
  methods: {
    dateTime: (value) => new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(value),
    async refresh() {
      if (!this.authenticated) return;

      const clients = await this.pi.getWireGuardClientsStatus();
      this.clients = clients.map((client) => {
        if (client.name.includes('@') && client.name.includes('.')) {
          client.avatar = `https://www.gravatar.com/avatar/${md5(client.name)}?d=blank`;
        }

        return client;
      });

      const {
        totalDownloaded,
        totalUploaded,
      } = clients.reduce((acc, curr) => {
        return {
          totalDownloaded: acc.totalDownloaded + (curr.transferTx || 0),
          totalUploaded: acc.totalUploaded + (curr.transferRx || 0),
        };
      }, {
        totalDownloaded: 0,
        totalUploaded: 0,
      });

      this.totalDownloaded = totalDownloaded;
      this.totalUploaded = totalUploaded;

      const TRAFFIC_LIMIT = 161061273600; // 150 GB
      const LIMIT_MULTIPLIER = 5;

      this.limitPerClient = (TRAFFIC_LIMIT / clients.length) * LIMIT_MULTIPLIER;
    },
    login(e) {
      if (!this.username) return;
      if (!this.password) return;
      if (this.authenticating) return;

      this.authenticating = true;
      this.pi.createSession({
        username: this.username,
        password: this.password,
      })
        .then(async () => {
          const session = await this.pi.getSession();
          this.authenticated = session.authenticated;
          this.hostname = session.hostname || null;
          this.username = session.username || null;
          return this.refresh();
        })
        .catch((err) => {
          Vue.$toast.error(err.message || err.toString());
        })
        .finally(() => {
          this.authenticating = false;
        });
    },
    logout(e) {
      this.pi.deleteSession()
        .then(() => {
          this.authenticated = false;
          this.hostname = null;
          this.username = null;
          this.clients = null;
        });
    },
    createClient() {
      const name = this.clientCreateName;
      if (!name) return;
      this.pi.createWireGuardClient({ name })
        .then(({ name }) => {
          Vue.$toast.success(`New client created: ${name}`);
        })
        .catch((err) => Vue.$toast.error(err.message || err.toString()))
        .finally(() => this.refresh().catch(console.error));
    },
    deleteClient({ name }) {
      this.pi.deleteWireGuardClient({ name })
        .then(({ name }) => {
          Vue.$toast.info(`Client deleted: ${name}`);
        })
        .catch((err) => Vue.$toast.error(err.message || err.toString()))
        .finally(() => this.refresh().catch(console.error));
    },
    enableOrDisableClient({ name, enabled }) {
      if (enabled) {
        this.pi.disableWireGuardClient({ name })
          .then(({ name }) => {
            Vue.$toast.info(`Client disabled: ${name}`);
          })
          .catch((err) => Vue.$toast.error(err.message || err.toString()))
          .finally(() => this.refresh().catch(console.error));
      } else {
        this.pi.enableWireGuardClient({ name })
          .then(({ name }) => {
            Vue.$toast.info(`Client enabled: ${name}`);
          })
          .catch((err) => Vue.$toast.error(err.message || err.toString()))
          .finally(() => this.refresh().catch(console.error));
      }
    },
  },
  filters: {
    timeago: (value) => timeago().format(value),
    bytes: (bytes, decimals, kib, maxunit) => {
      kib = kib || false;
      if (bytes === 0) return '0 Bytes';
      if (isNaN(parseFloat(bytes)) && !isFinite(bytes)) return 'Not an number';
      const k = kib ? 1024 : 1000;
      const dm = decimals != null && !isNaN(decimals) && decimals >= 0 ? decimals : 2;
      const sizes = kib ? ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB', 'BiB'] : ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB', 'BB'];
      let i = Math.floor(Math.log(bytes) / Math.log(k));
      if (maxunit != undefined) {
        const index = sizes.indexOf(maxunit);
        if (index != -1) i = index;
      }
      return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
    },
  },
  mounted() {
    this.appInitialized = true
    this.pi = new PiVPN();
    this.pi.getSession()
      .then((session) => {
        this.authenticated = session.authenticated;
        this.hostname = session.hostname || null;
        this.username = session.username || null;
        this.refresh().catch((err) => {
          Vue.$toast.error(err.message || err.toString());
        });
      })
      .catch((err) => {
        Vue.$toast.error(err.message || err.toString());
      });

    setInterval(() => {
      this.refresh().catch(console.error);
    }, 2000);
  },
});

// Modal component
Vue.component('modal', {
  template: '#modal-template',
  mounted() {
    document.body.classList.add('overflow-hidden');
    this.trap = focusTrap.createFocusTrap(this.$el);
    this.trap.activate();
  },
  destroyed() {
    document.body.classList.remove('overflow-hidden');
    this.trap.deactivate();
  },
});

Vue.use(VueToast, {
  position: 'top',
});
