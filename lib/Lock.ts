import { Repository } from 'typeorm';
import { Lock as LockEntity } from './entities';
import { addSeconds, isAfter } from 'date-fns';

import _debug from 'debug';
import { Datasource } from './Datasource';

const debug = _debug('Lock');

export class Lock {
  constructor(private readonly lockRepository: Repository<LockEntity>) {}

  private async acquireLock(name: string, ttlSeconds = 30) {
    const now = new Date();
    const validTill = addSeconds(now, ttlSeconds);

    try {
      return this.lockRepository.manager.transaction(async (entityManager) => {
        const lock = await entityManager.findOneBy(LockEntity, { id: name });
        if (!lock || isAfter(now, lock.validTill)) {
          await entityManager.upsert(
            LockEntity,
            this.createLockEntity(name, validTill),
            { conflictPaths: { id: true }, upsertType: 'on-conflict-do-update' },
          );

          return true;
        }

        return false;
      });
    }
    catch (ex: unknown) {
      debug(ex);
      return false;
    }
  }

  private createLockEntity(name: string, validTill: Date): LockEntity {
    const lockEntity = new LockEntity();
    lockEntity.id = name;
    lockEntity.validTill = validTill;
    return lockEntity;
  }

  private async releaseLock(name: string) {
    await this.lockRepository.delete(name);
  }

  public async acquireAndExecute({ name, ttlSeconds }: { name: string; ttlSeconds?: number }, fn: () => Promise<void>) {
    const locked = await this.acquireLock(name, ttlSeconds);
    if (!locked) {
      return;
    }

    try {
      await fn();
    }
    catch (ex: unknown) {
      debug(ex);
    }
    finally {
      await this.releaseLock(name);
    }
  }
}

export const lock = new Lock(Datasource.getRepository(LockEntity));
