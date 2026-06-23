import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedActor {
  name: string;
  email: string;
  expiresAt: number;
}

/**
 * Resolves a userId to { name, email } with a 5-minute in-memory cache.
 * Keeps actor name/email as a snapshot at write time — even if the user
 * is later renamed or deleted, audit records stay accurate.
 */
@Injectable()
export class AuditActorResolver {
  private readonly logger = new Logger(AuditActorResolver.name);
  private readonly cache = new Map<string, CachedActor>();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async resolve(userId: string): Promise<{ name: string; email: string }> {
    const cached = this.cache.get(userId);
    if (cached && Date.now() < cached.expiresAt) {
      return { name: cached.name, email: cached.email };
    }

    return this.fetchAndCache(userId);
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  private async fetchAndCache(userId: string): Promise<{ name: string; email: string }> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: userId },
        select: ['first_name', 'last_name', 'email'],
      });

      const snapshot = user
        ? { name: [user.first_name, user.last_name].filter(Boolean).join(' '), email: user.email }
        : { name: `Deleted User (${userId.slice(0, 8)}…)`, email: '' };

      this.cache.set(userId, { ...snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
      return snapshot;
    } catch (err) {
      this.logger.warn(`Could not resolve actor ${userId}: ${(err as Error).message}`);
      return { name: userId, email: '' };
    }
  }
}
