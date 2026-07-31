import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearPendingReturn,
  peekPendingReturn,
  savePendingReturn,
  takePendingReturn,
} from '../pending-return';

/**
 * The parked draft decides both what add-person restores and where the Gmail
 * deep-link return navigates back to, so the guards here matter: expiry and
 * one-shot consumption, which are what keep a stale record from surfacing in an
 * unrelated visit later.
 */
describe('pending-return', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.useRealTimers();
  });

  it('round-trips a parked draft', async () => {
    await savePendingReturn({ pathname: '/add-person', draft: { name: 'Emma' } });
    await expect(peekPendingReturn()).resolves.toMatchObject({
      pathname: '/add-person',
      draft: { name: 'Emma' },
    });
  });

  it('keeps route params for the trip back', async () => {
    await savePendingReturn({ pathname: '/person/[id]', params: { id: 'p1' } });
    const parked = await peekPendingReturn();
    expect(parked?.params).toEqual({ id: 'p1' });
  });

  it('peek leaves the record; take consumes it', async () => {
    await savePendingReturn({ pathname: '/add-person' });
    await expect(peekPendingReturn()).resolves.not.toBeNull();
    await expect(peekPendingReturn()).resolves.not.toBeNull();
    await expect(takePendingReturn()).resolves.not.toBeNull();
    await expect(peekPendingReturn()).resolves.toBeNull();
  });

  it('expires after 30 minutes so an abandoned connect cannot resurface', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-31T10:00:00Z'));
    await savePendingReturn({ pathname: '/add-person' });

    jest.setSystemTime(new Date('2026-07-31T10:29:00Z'));
    await expect(peekPendingReturn()).resolves.not.toBeNull();

    jest.setSystemTime(new Date('2026-07-31T10:31:00Z'));
    await expect(peekPendingReturn()).resolves.toBeNull();
  });

  it('survives a corrupt record', async () => {
    await AsyncStorage.setItem('circle_pending_return', 'not json');
    await expect(peekPendingReturn()).resolves.toBeNull();
  });

  it('clear removes the record', async () => {
    await savePendingReturn({ pathname: '/add-person' });
    await clearPendingReturn();
    await expect(peekPendingReturn()).resolves.toBeNull();
  });
});
