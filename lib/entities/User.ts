import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryColumn()
  id!: string;

  @Index({ unique: true })
  @Column()
  login!: string;

  @Column()
  password!: string;

  @Column()
  admin!: boolean;
}
