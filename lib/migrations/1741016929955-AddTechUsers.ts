import { MigrationInterface, QueryRunner } from 'typeorm';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { TECH_USER, TECH_PASSWORD } from '../../config';

export class AddTechUsers1741016929955 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const salt = await bcrypt.genSalt(10);
    const techUserPasswordHash = await bcrypt.hash(TECH_PASSWORD ?? '', salt);

    await queryRunner.query(`INSERT INTO "user" (id, login, password, admin) VALUES (?, ?, ?, ?)`, [uuidv4(), TECH_USER, techUserPasswordHash, true]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "user" WHERE login = ?;`, [TECH_USER]);
  }
}
