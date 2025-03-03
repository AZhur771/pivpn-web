import { MigrationInterface, QueryRunner } from 'typeorm';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { ADMIN_PASSWORD, ADMIN_USER, VIEWER_PASSWORD, VIEWER_USER } from '../../config';

export class AddUsers1741016929954 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD ?? '', salt);
    const viewerPasswordHash = await bcrypt.hash(VIEWER_PASSWORD ?? '', salt);

    await queryRunner.query(`INSERT INTO "user" (id, login, password, admin) VALUES (?, ?, ?, ?)`, [uuidv4(), ADMIN_USER, adminPasswordHash, true]);
    await queryRunner.query(`INSERT INTO "user" (id, login, password, admin) VALUES (?, ?, ?, ?)`, [uuidv4(), VIEWER_USER, viewerPasswordHash, false]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "user" WHERE login in :?;`, [[ADMIN_USER, VIEWER_USER]]);
  }
}
