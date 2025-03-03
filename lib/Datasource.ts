import { DataSource as TypeormDataSource } from 'typeorm';

export const Datasource = new TypeormDataSource({
  type: 'sqlite',
  database: 'pivpn.sqlite',
  synchronize: false,
  logging: true,
  entities: [__dirname + '/entities/*.ts'],
  migrations: [__dirname + '/migrations/*.ts'],
  subscribers: [],
});
