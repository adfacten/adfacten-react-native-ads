import type { EventSubscription } from 'react-native';
import type { NativeAdEvent } from './specs/NativeAdfactenAds';
import { nativeModule } from './native';
import { AdfactenError, errorFromEvent, errorFromRejection } from './errors';

/** A loaded ad can be shown for about 55 minutes. */
export const AD_TTL_MS = 55 * 60 * 1000;

export type AdReward = {
  /** Reward type configured on the placement, e.g. "coins". */
  type: string;
  amount: number;
};

export type FullScreenAdEvents = {
  /** The ad is on screen and the impression was recorded. */
  shown: () => void;
  clicked: () => void;
  /** The ad was dismissed. Resume your app and load the next ad here. */
  closed: () => void;
  failedToShow: (error: AdfactenError) => void;
};

export type RewardedAdEvents = FullScreenAdEvents & {
  /** The user finished the ad. Client side, for UX only: credit rewards from your server callback. */
  userEarnedReward: (reward: AdReward) => void;
};

type Format = 'interstitial' | 'rewarded' | 'app_open';
type State = 'loaded' | 'showing' | 'shown' | 'destroyed';
type AnyListener = (...args: any[]) => void;

const ads = new Map<string, FullScreenAd<any>>();
let subscription: EventSubscription | null = null;
let counter = 0;

function ensureSubscribed(): void {
  if (subscription) return;
  subscription = nativeModule().onAdEvent((event: NativeAdEvent) => {
    ads.get(event.adId)?.handleNativeEvent(event);
  });
}

function nextId(format: Format): string {
  counter += 1;
  return `${format}-${Date.now().toString(36)}-${counter}`;
}

async function loadNative(
  format: Format,
  placementId: string,
  customData?: string
): Promise<{ adId: string; reward: AdReward | null }> {
  if (typeof placementId !== 'string' || placementId.trim() === '') {
    throw new AdfactenError('INVALID_REQUEST', 'placementId is empty');
  }
  const native = nativeModule();
  ensureSubscribed();
  const adId = nextId(format);
  const options: { customData?: string } = {};
  if (customData != null) options.customData = String(customData).slice(0, 256);
  try {
    const result = await native.loadFullScreenAd(
      format,
      adId,
      placementId.trim(),
      options
    );
    const reward =
      result && typeof result.rewardType === 'string' && result.rewardType
        ? { type: result.rewardType, amount: Number(result.rewardAmount ?? 0) }
        : null;
    return { adId, reward };
  } catch (e) {
    throw errorFromRejection(e);
  }
}

/** Common part of InterstitialAd, RewardedAd and AppOpenAd. Each loaded ad can be shown once. */
export abstract class FullScreenAd<E extends FullScreenAdEvents> {
  readonly placementId: string;
  /** When the ad finished loading (ms since epoch). */
  readonly loadedAt: number;

  /** @internal */
  protected readonly adId: string;
  private state: State = 'loaded';
  private listeners = new Map<keyof E, Set<AnyListener>>();
  private pendingShow: {
    resolve: () => void;
    reject: (e: AdfactenError) => void;
  } | null = null;

  protected constructor(adId: string, placementId: string) {
    this.adId = adId;
    this.placementId = placementId;
    this.loadedAt = Date.now();
    ads.set(adId, this);
  }

  /** True until the ad is shown, destroyed or expired. */
  get isReady(): boolean {
    return this.state === 'loaded' && !this.isExpired;
  }

  get isExpired(): boolean {
    return Date.now() - this.loadedAt >= AD_TTL_MS;
  }

  addListener<K extends keyof E>(
    event: K,
    listener: E[K]
  ): { remove: () => void } {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as AnyListener);
    return { remove: () => this.removeListener(event, listener) };
  }

  removeListener<K extends keyof E>(event: K, listener: E[K]): void {
    this.listeners.get(event)?.delete(listener as AnyListener);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Presents the ad full screen. Resolves when it is on screen; rejects with an AdfactenError
   * if it cannot be shown (expired, already shown, another ad on screen, app in background).
   */
  show(): Promise<void> {
    if (
      this.state === 'destroyed' ||
      this.state === 'shown' ||
      this.state === 'showing'
    ) {
      return this.failShowEarly(
        new AdfactenError(
          'NOT_READY',
          'this ad was already shown or destroyed; load a new one'
        )
      );
    }
    if (this.isExpired) {
      return this.failShowEarly(
        new AdfactenError('AD_EXPIRED', 'the ad expired; load a new one')
      );
    }
    this.state = 'showing';
    return new Promise<void>((resolve, reject) => {
      this.pendingShow = { resolve, reject };
      try {
        nativeModule().showFullScreenAd(this.adId);
      } catch (e) {
        this.handleNativeEvent({
          adId: this.adId,
          type: 'failedToShow',
          errorCode: 'INTERNAL_ERROR',
          errorMessage: e instanceof Error ? e.message : String(e),
        });
      }
    });
  }

  /** Releases the native ad. Not needed after the ad was closed; call it if you never show it. */
  destroy(): void {
    if (this.state === 'destroyed') return;
    const wasShowing = this.state === 'showing';
    this.state = 'destroyed';
    ads.delete(this.adId);
    this.listeners.clear();
    if (this.pendingShow && wasShowing) {
      this.pendingShow.reject(
        new AdfactenError('NOT_READY', 'the ad was destroyed')
      );
    }
    this.pendingShow = null;
    try {
      nativeModule().destroyFullScreenAd(this.adId);
    } catch {
      // The module is gone (e.g. during a reload); nothing to release.
    }
  }

  /** @internal */
  handleNativeEvent(event: NativeAdEvent): void {
    switch (event.type) {
      case 'shown':
        this.state = 'shown';
        this.pendingShow?.resolve();
        this.pendingShow = null;
        this.emit('shown');
        break;
      case 'clicked':
        this.emit('clicked');
        break;
      case 'closed':
        this.state = 'shown';
        this.emit('closed');
        this.destroy();
        break;
      case 'failedToShow': {
        const error = errorFromEvent({
          code: event.errorCode,
          message: event.errorMessage,
          serverCode: event.serverCode,
          nativeCode: event.nativeCode,
        });
        if (this.state === 'shown') {
          // Playback broke after the ad was on screen. Report it, then finish like a close so
          // apps waiting for `closed` can resume.
          this.emit('failedToShow', error);
          this.emit('closed');
          this.destroy();
          break;
        }
        // The native SDKs only mark an ad as used once it is presented, so a failed attempt
        // (e.g. another ad on screen) can be retried.
        if (this.state === 'showing') this.state = 'loaded';
        this.pendingShow?.reject(error);
        this.pendingShow = null;
        this.emit('failedToShow', error);
        break;
      }
      case 'userEarnedReward':
        this.onReward({
          type: event.rewardType ?? '',
          amount: Number(event.rewardAmount ?? 0),
        });
        break;
    }
  }

  protected onReward(_reward: AdReward): void {}

  protected emit(event: keyof E, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        listener(...args);
      } catch (e) {
        console.error(`[Adfacten] error in "${String(event)}" listener`, e);
      }
    }
  }

  private failShowEarly(error: AdfactenError): Promise<void> {
    this.emit('failedToShow', error);
    return Promise.reject(error);
  }
}

/** A full-screen ad shown at natural breaks (between levels, screens, ...). */
export class InterstitialAd extends FullScreenAd<FullScreenAdEvents> {
  private constructor(adId: string, placementId: string) {
    super(adId, placementId);
  }

  /** Loads an interstitial for `placementId` (`plc_…`). Rejects with an AdfactenError. */
  static async load(placementId: string): Promise<InterstitialAd> {
    const { adId } = await loadNative('interstitial', placementId);
    return new InterstitialAd(adId, placementId);
  }
}

/** A full-screen ad shown when the app is opened or comes back to the foreground. */
export class AppOpenAd extends FullScreenAd<FullScreenAdEvents> {
  private constructor(adId: string, placementId: string) {
    super(adId, placementId);
  }

  static async load(placementId: string): Promise<AppOpenAd> {
    const { adId } = await loadNative('app_open', placementId);
    return new AppOpenAd(adId, placementId);
  }
}

export type RewardedAdLoadOptions = {
  /** Up to 256 characters, echoed as `custom` in the server-side reward callback. */
  customData?: string;
};

export type RewardedAdShowOptions = {
  onUserEarnedReward?: (reward: AdReward) => void;
};

/**
 * A full-screen ad the user opts into for a reward. Rewards are granted by Adfacten's signed
 * server-side callback to your backend; `userEarnedReward` is for UX only.
 */
export class RewardedAd extends FullScreenAd<RewardedAdEvents> {
  /** The reward configured on the placement, or null if the server sent none. */
  readonly reward: AdReward | null;
  private rewardCallback: ((reward: AdReward) => void) | null = null;

  private constructor(
    adId: string,
    placementId: string,
    reward: AdReward | null
  ) {
    super(adId, placementId);
    this.reward = reward;
  }

  static async load(
    placementId: string,
    options: RewardedAdLoadOptions = {}
  ): Promise<RewardedAd> {
    const { adId, reward } = await loadNative(
      'rewarded',
      placementId,
      options.customData
    );
    return new RewardedAd(adId, placementId, reward);
  }

  override show(options: RewardedAdShowOptions = {}): Promise<void> {
    this.rewardCallback = options.onUserEarnedReward ?? null;
    return super.show();
  }

  protected override onReward(reward: AdReward): void {
    const cb = this.rewardCallback;
    this.rewardCallback = null;
    if (cb) {
      try {
        cb(reward);
      } catch (e) {
        console.error('[Adfacten] error in onUserEarnedReward', e);
      }
    }
    this.emit('userEarnedReward', reward);
  }
}

/** @internal Test helper: forget all ads and the native subscription. */
export function __resetForTests(): void {
  subscription?.remove();
  subscription = null;
  ads.clear();
  counter = 0;
}
