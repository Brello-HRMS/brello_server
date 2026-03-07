import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { Session } from '../entities/session.entity';

// Session Repository - Implements the Repository Pattern to encapsulate data access logic
@Injectable()
export class SessionRepository {
  constructor(
    @InjectRepository(Session)
    private readonly repository: Repository<Session>,
  ) {}

  // Create a new session
  async create(session: Partial<Session>): Promise<Session> {
    const newSession = this.repository.create(session);
    return this.repository.save(newSession);
  }

  // Find session by ID
  async findById(id: string): Promise<Session | null> {
    return this.repository.findOne({ where: { id } });
  }

  // Find session by refresh token hash
  async findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<Session | null> {
    return this.repository.findOne({
      where: { refresh_token_hash: refreshTokenHash, logout_time: IsNull() },
    });
  }

  // Find active sessions for a user
  async findActiveSessionsByUserId(userId: string): Promise<Session[]> {
    return this.repository.find({
      where: {
        user_id: userId,
        logout_time: IsNull(),
        expires_at: LessThan(new Date()),
      },
      order: { login_time: 'DESC' },
    });
  }

  // Update a session
  async update(
    id: string,
    updateData: Partial<Session>,
  ): Promise<Session | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  // Mark session as logged out
  async logout(id: string): Promise<Session | null> {
    await this.repository.update(id, { logout_time: new Date() });
    return this.findById(id);
  }

  // Delete expired sessions
  async deleteExpiredSessions(): Promise<number> {
    const result = await this.repository.delete({
      expires_at: LessThan(new Date()),
    });
    return result.affected || 0;
  }

  // Delete all sessions for a user
  async deleteAllUserSessions(userId: string): Promise<number> {
    const result = await this.repository.delete({ user_id: userId });
    return result.affected || 0;
  }
}
