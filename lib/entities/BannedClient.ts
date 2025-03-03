import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class BannedClient {
  @PrimaryColumn()
  publicKey!: string;

  @Column()
  bannedTill!: Date;

  @Column()
  totalDownloaded!: number;
}
