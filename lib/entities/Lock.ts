import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Lock {
  @PrimaryColumn()
  id!: string;

  @Column()
  validTill!: Date;
}
