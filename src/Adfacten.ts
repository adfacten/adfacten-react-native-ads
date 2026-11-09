import { nativeModule } from './native';
import { VERSION } from './version';

export type LogLevel = 'none' | 'error' | 'warning' | 'info' | 'debug';

export type AdfactenConfig = {
  /** Request test ads. Test ads are never billed. Turn it off for release builds. */
  testMode?: boolean;
  /** Native log output (Logcat tag `Adfacten`, iOS subsystem `com.adfacten.ads`). Default `warning`. */
  logLevel?: LogLevel;
  /**
   * The app or this user is directed at children (COPPA / Google Families). The SDK then never
   * reads device advertising identifiers, and Adfacten does not serve ads to such traffic.
   */
  childDirected?: boolean;
  /** Your user id, sent with rewarded requests and echoed in the server-side reward callback. */
  userId?: string;
};

const LOG_LEVELS: readonly LogLevel[] = [
  'none',
  'error',
  'warning',
  'info',
  'debug',
];

let initialized = false;

/**
 * Initializes the native SDK. Call once, as early as possible (for example in your root
 * component's module scope or first effect). Calling it again replaces the configuration.
 *
 * @param appKey the platform's app key (`apk_…`) from the Adfacten panel. Android and iOS apps
 *   have different keys; use `Platform.select`.
 */
function initialize(appKey: string, config: AdfactenConfig = {}): void {
  const key = typeof appKey === 'string' ? appKey.trim() : '';
  if (!key.startsWith('apk_') || key.length <= 4) {
    console.warn(
      `[Adfacten] "${appKey}" does not look like an Adfacten app key (apk_…). Ads will not load.`
    );
  }
  if (config.logLevel !== undefined && !LOG_LEVELS.includes(config.logLevel)) {
    console.warn(
      `[Adfacten] unknown logLevel "${config.logLevel}", using "warning".`
    );
  }
  const nativeConfig: {
    testMode?: boolean;
    logLevel?: string;
    childDirected?: boolean;
    userId?: string;
    pluginVersion?: string;
  } = { pluginVersion: VERSION };
  if (config.testMode !== undefined) nativeConfig.testMode = !!config.testMode;
  if (config.logLevel !== undefined) nativeConfig.logLevel = config.logLevel;
  if (config.childDirected !== undefined)
    nativeConfig.childDirected = !!config.childDirected;
  if (config.userId) nativeConfig.userId = String(config.userId).slice(0, 256);
  nativeModule().initialize(key, nativeConfig);
  initialized = true;
}

/** Sets (or clears, with null) the user id used for rewarded server-side callbacks. */
function setUserId(userId: string | null): void {
  nativeModule().setUserId(userId ? String(userId).slice(0, 256) : null);
}

/** Whether `initialize` was called in this JS session. */
function isInitialized(): boolean {
  return initialized;
}

/** Version of the native Adfacten SDK in this build, e.g. "1.0.2". */
function getSdkVersion(): Promise<string> {
  return nativeModule().getSdkVersion();
}

export const Adfacten = {
  /** Version of this package. The native SDKs report it with each ad request. */
  version: VERSION,
  initialize,
  setUserId,
  isInitialized,
  getSdkVersion,
} as const;
