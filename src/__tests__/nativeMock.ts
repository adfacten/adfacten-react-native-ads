import type { NativeAdEvent } from '../specs/NativeAdfactenAds';

type Listener = (e: NativeAdEvent) => void;

/** A stand-in for the TurboModule that records calls and lets tests push events. */
export function createNativeMock() {
  const listeners = new Set<Listener>();
  const mock = {
    initialize: jest.fn(),
    setUserId: jest.fn(),
    getSdkVersion: jest.fn(() => Promise.resolve('1.0.0')),
    loadFullScreenAd: jest.fn(
      (
        _format: string,
        _adId: string,
        _placementId: string,
        _options: object
      ) =>
        Promise.resolve({}) as Promise<{
          rewardType?: string;
          rewardAmount?: number;
        }>
    ),
    showFullScreenAd: jest.fn(),
    destroyFullScreenAd: jest.fn(),
    onAdEvent: jest.fn((listener: Listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    }),
    emit(event: NativeAdEvent) {
      listeners.forEach((l) => l(event));
    },
    listenerCount: () => listeners.size,
    lastAdId(): string {
      const calls = mock.loadFullScreenAd.mock.calls;
      return calls[calls.length - 1]![1];
    },
  };
  return mock;
}

export type NativeMock = ReturnType<typeof createNativeMock>;
