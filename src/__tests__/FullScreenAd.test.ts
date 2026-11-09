import { createNativeMock, type NativeMock } from './nativeMock';

let mockNative: NativeMock;

jest.mock('../specs/NativeAdfactenAds', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
}));

// Imported after the mock is set up.
import {
  AD_TTL_MS,
  AppOpenAd,
  InterstitialAd,
  RewardedAd,
  __resetForTests,
} from '../FullScreenAd';
import { AdfactenError } from '../errors';

beforeEach(() => {
  mockNative = createNativeMock();
  __resetForTests();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('loading', () => {
  it('loads an interstitial with a unique id', async () => {
    const a = await InterstitialAd.load('plc_a');
    const b = await InterstitialAd.load('plc_a');
    expect(a.placementId).toBe('plc_a');
    expect(a.isReady).toBe(true);
    const [first, second] = mockNative.loadFullScreenAd.mock.calls;
    expect(first![0]).toBe('interstitial');
    expect(first![1]).not.toBe(second![1]);
    expect(first![2]).toBe('plc_a');
    expect(b.isReady).toBe(true);
  });

  it('uses the app_open format for app open ads', async () => {
    await AppOpenAd.load('plc_open');
    expect(mockNative.loadFullScreenAd.mock.calls[0]![0]).toBe('app_open');
  });

  it('rejects with a typed error', async () => {
    mockNative.loadFullScreenAd.mockImplementationOnce(() =>
      Promise.reject(
        Object.assign(new Error('placement belongs to another app'), {
          code: 'rejected',
          userInfo: { serverCode: 'placement_mismatch', nativeCode: 7 },
        })
      )
    );
    await expect(InterstitialAd.load('plc_x')).rejects.toMatchObject({
      name: 'AdfactenError',
      code: 'REJECTED',
      errorName: 'rejected',
      serverCode: 'placement_mismatch',
    });
  });

  it('refuses an empty placement id without calling native', async () => {
    await expect(InterstitialAd.load('  ')).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      errorName: 'invalid_request',
    });
    expect(mockNative.loadFullScreenAd).not.toHaveBeenCalled();
  });

  it('passes customData (capped at 256 chars) and exposes the reward', async () => {
    mockNative.loadFullScreenAd.mockImplementationOnce(() =>
      Promise.resolve({ rewardType: 'coins', rewardAmount: 10 })
    );
    const ad = await RewardedAd.load('plc_r', { customData: 'x'.repeat(300) });
    const options = mockNative.loadFullScreenAd.mock.calls[0]![3] as {
      customData: string;
    };
    expect(options.customData).toHaveLength(256);
    expect(ad.reward).toEqual({ type: 'coins', amount: 10 });
  });

  it('reports no reward when the placement has none', async () => {
    const ad = await RewardedAd.load('plc_r');
    expect(ad.reward).toBeNull();
    expect(mockNative.loadFullScreenAd.mock.calls[0]![3]).toEqual({});
  });
});

describe('showing', () => {
  it('resolves show() when the ad is on screen and cleans up after close', async () => {
    const ad = await InterstitialAd.load('plc_a');
    const id = mockNative.lastAdId();
    const events: string[] = [];
    ad.addListener('shown', () => events.push('shown'));
    ad.addListener('clicked', () => events.push('clicked'));
    ad.addListener('closed', () => events.push('closed'));

    const shown = ad.show();
    expect(mockNative.showFullScreenAd).toHaveBeenCalledWith(id);
    expect(ad.isReady).toBe(false);
    mockNative.emit({ adId: id, type: 'shown' });
    await expect(shown).resolves.toBeUndefined();
    mockNative.emit({ adId: id, type: 'clicked' });
    mockNative.emit({ adId: id, type: 'closed' });

    expect(events).toEqual(['shown', 'clicked', 'closed']);
    expect(mockNative.destroyFullScreenAd).toHaveBeenCalledWith(id);
    // Late events for a finished ad are ignored.
    mockNative.emit({ adId: id, type: 'clicked' });
    expect(events).toHaveLength(3);
  });

  it('routes events by ad id', async () => {
    const a = await InterstitialAd.load('plc_a');
    const idA = mockNative.lastAdId();
    const b = await InterstitialAd.load('plc_b');
    const onA = jest.fn();
    const onB = jest.fn();
    a.addListener('clicked', onA);
    b.addListener('clicked', onB);
    mockNative.emit({ adId: idA, type: 'clicked' });
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
    expect(mockNative.onAdEvent).toHaveBeenCalledTimes(1);
  });

  it('rejects show() on failedToShow and allows a retry', async () => {
    const ad = await InterstitialAd.load('plc_a');
    const id = mockNative.lastAdId();
    const onFailed = jest.fn();
    ad.addListener('failedToShow', onFailed);

    const attempt = ad.show();
    mockNative.emit({
      adId: id,
      type: 'failedToShow',
      errorCode: 'show_failed',
      errorMessage: 'another ad is on screen',
      nativeCode: 11,
    });
    await expect(attempt).rejects.toMatchObject({
      code: 'SHOW_FAILED',
      errorName: 'show_failed',
      nativeCode: 11,
    });
    expect(onFailed.mock.calls[0]![0]).toBeInstanceOf(AdfactenError);
    expect(ad.isReady).toBe(true);

    const retry = ad.show();
    mockNative.emit({ adId: id, type: 'shown' });
    await expect(retry).resolves.toBeUndefined();
  });

  it('treats a failure after the ad was shown as a close', async () => {
    const ad = await InterstitialAd.load('plc_a');
    const id = mockNative.lastAdId();
    const order: string[] = [];
    ad.addListener('failedToShow', (e) => order.push(`failed:${e.code}`));
    ad.addListener('closed', () => order.push('closed'));
    const shown = ad.show();
    mockNative.emit({ adId: id, type: 'shown' });
    await shown;
    mockNative.emit({
      adId: id,
      type: 'failedToShow',
      errorCode: 'creative_failed',
      errorMessage: 'video',
    });
    expect(order).toEqual(['failed:CREATIVE_FAILED', 'closed']);
    expect(mockNative.destroyFullScreenAd).toHaveBeenCalledWith(id);
  });

  it('does not show an ad twice', async () => {
    const ad = await InterstitialAd.load('plc_a');
    const id = mockNative.lastAdId();
    const first = ad.show();
    mockNative.emit({ adId: id, type: 'shown' });
    await first;
    await expect(ad.show()).rejects.toMatchObject({ code: 'NOT_READY' });
    expect(mockNative.showFullScreenAd).toHaveBeenCalledTimes(1);
  });

  it('refuses to show an expired ad', async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    const ad = await InterstitialAd.load('plc_a');
    jest.setSystemTime(1_000_000 + AD_TTL_MS + 1);
    expect(ad.isExpired).toBe(true);
    expect(ad.isReady).toBe(false);
    await expect(ad.show()).rejects.toMatchObject({ code: 'AD_EXPIRED' });
    expect(mockNative.showFullScreenAd).not.toHaveBeenCalled();
  });

  it('rejects a pending show when destroyed', async () => {
    const ad = await InterstitialAd.load('plc_a');
    const id = mockNative.lastAdId();
    const pending = ad.show();
    ad.destroy();
    await expect(pending).rejects.toMatchObject({ code: 'NOT_READY' });
    expect(mockNative.destroyFullScreenAd).toHaveBeenCalledWith(id);
    ad.destroy();
    expect(mockNative.destroyFullScreenAd).toHaveBeenCalledTimes(1);
  });

  it('keeps going when a listener throws', async () => {
    const ad = await InterstitialAd.load('plc_a');
    const id = mockNative.lastAdId();
    const after = jest.fn();
    ad.addListener('clicked', () => {
      throw new Error('app bug');
    });
    ad.addListener('clicked', after);
    mockNative.emit({ adId: id, type: 'clicked' });
    expect(after).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('removes listeners', async () => {
    const ad = await InterstitialAd.load('plc_a');
    const id = mockNative.lastAdId();
    const fn = jest.fn();
    const sub = ad.addListener('clicked', fn);
    sub.remove();
    mockNative.emit({ adId: id, type: 'clicked' });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('rewarded', () => {
  it('delivers the reward to the show callback and the listener', async () => {
    mockNative.loadFullScreenAd.mockImplementationOnce(() =>
      Promise.resolve({ rewardType: 'coins', rewardAmount: 10 })
    );
    const ad = await RewardedAd.load('plc_r');
    const id = mockNative.lastAdId();
    const onEarned = jest.fn();
    const listener = jest.fn();
    ad.addListener('userEarnedReward', listener);
    const shown = ad.show({ onUserEarnedReward: onEarned });
    mockNative.emit({ adId: id, type: 'shown' });
    await shown;
    mockNative.emit({
      adId: id,
      type: 'userEarnedReward',
      rewardType: 'coins',
      rewardAmount: 10,
    });
    mockNative.emit({ adId: id, type: 'closed' });
    expect(onEarned).toHaveBeenCalledWith({ type: 'coins', amount: 10 });
    expect(listener).toHaveBeenCalledWith({ type: 'coins', amount: 10 });
  });
});
