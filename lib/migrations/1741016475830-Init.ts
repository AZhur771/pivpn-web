import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1741016475830 implements MigrationInterface {
  name = 'Init1741016475830';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "session" ("id" varchar PRIMARY KEY NOT NULL, "expiresAt" integer NOT NULL, "data" varchar NOT NULL)`);
    await queryRunner.query(`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "login" varchar NOT NULL, "password" varchar NOT NULL, "admin" boolean NOT NULL)`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a62473490b3e4578fd683235c5" ON "user" ("login") `);
    await queryRunner.query(`CREATE TABLE "lock" ("id" varchar PRIMARY KEY NOT NULL, "validTill" datetime NOT NULL)`);
    await queryRunner.query(`CREATE TABLE "banned_client" ("publicKey" varchar PRIMARY KEY NOT NULL, "bannedTill" datetime NOT NULL, "totalDownloaded" integer NOT NULL)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "banned_client"`);
    await queryRunner.query(`DROP TABLE "lock"`);
    await queryRunner.query(`DROP INDEX "IDX_a62473490b3e4578fd683235c5"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "session"`);
  }
}
