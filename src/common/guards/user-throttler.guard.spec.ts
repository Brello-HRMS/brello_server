import { UserThrottlerGuard } from './user-throttler.guard';

describe('UserThrottlerGuard', () => {
  const guard = new UserThrottlerGuard({} as any, {} as any, {} as any);
  const getTracker = (guard as any).getTracker.bind(guard);

  it('tracks by authenticated user id when available', async () => {
    const tracker = await getTracker({ user: { userId: 'user1' }, ip: '1.2.3.4' });
    expect(tracker).toBe('user1');
  });

  it('falls back to IP when there is no authenticated user', async () => {
    const tracker = await getTracker({ ip: '1.2.3.4' });
    expect(tracker).toBe('1.2.3.4');
  });
});
