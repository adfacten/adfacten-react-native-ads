import { TurboModuleRegistry, type TurboModule } from 'react-native';
import type { CodegenTypes } from 'react-native';

export type NativeConfig = {
  testMode?: boolean;
  logLevel?: string;
  childDirected?: boolean;
  userId?: string;
  /** Version of this package, reported to the SDK with the wrapper name. */
  pluginVersion?: string;
};

export type NativeLoadOptions = {
  customData?: string;
};

export type NativeLoadResult = {
  rewardType?: string;
  rewardAmount?: CodegenTypes.Double;
};

/**
 * One event of a full-screen ad. `type` is one of `shown`, `clicked`, `closed`,
 * `failedToShow` or `userEarnedReward`.
 */
export type NativeAdEvent = {
  adId: string;
  type: string;
  errorCode?: string;
  errorMessage?: string;
  serverCode?: string;
  nativeCode?: CodegenTypes.Int32;
  rewardType?: string;
  rewardAmount?: CodegenTypes.Double;
};

export interface Spec extends TurboModule {
  initialize(appKey: string, config: NativeConfig): void;
  setUserId(userId: string | null): void;
  getSdkVersion(): Promise<string>;

  /** Loads a full-screen ad and keeps it under `adId`. Format: interstitial, rewarded or app_open. */
  loadFullScreenAd(
    format: string,
    adId: string,
    placementId: string,
    options: NativeLoadOptions
  ): Promise<NativeLoadResult>;
  /** Starts presenting. The outcome arrives as a `shown` or `failedToShow` event. */
  showFullScreenAd(adId: string): void;
  destroyFullScreenAd(adId: string): void;

  readonly onAdEvent: CodegenTypes.EventEmitter<NativeAdEvent>;
}

export default TurboModuleRegistry.get<Spec>('RNAdfactenAds');
