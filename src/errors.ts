/**
 * Error codes shared by both platforms: the native SDK's stable error name in upper case
 * (`no_fill` is `NO_FILL`). `already_shown` and `not_ready` are both `NOT_READY`.
 */
export type AdfactenErrorCode =
  /** `Adfacten.initialize` was not called, or the app key is malformed. */
  | 'NOT_INITIALIZED'
  /** The request was invalid (for example an empty placement id). */
  | 'INVALID_REQUEST'
  /** Network failure or timeout. */
  | 'NETWORK_ERROR'
  /** No ad right now. The SDK waits at least 30 s before asking again for that placement. */
  | 'NO_FILL'
  /** The ad server had an error. */
  | 'SERVER_ERROR'
  /** The ad server sent a response the SDK could not use. */
  | 'INVALID_RESPONSE'
  /** The server refused the request; see `serverCode`. */
  | 'REJECTED'
  /** The ad was loaded about 55 minutes ago or more. Load a new one. */
  | 'AD_EXPIRED'
  /** The ad was already shown, destroyed, or is not loaded. Full-screen ads are single use. */
  | 'NOT_READY'
  /** The ad could not be presented (no foreground activity / view controller, or another ad is on screen). */
  | 'SHOW_FAILED'
  /** A video ad was served but video support is not included (Android `adfactenVideo=false`). */
  | 'VIDEO_NOT_SUPPORTED'
  /** A load for this ad is already running. */
  | 'LOAD_IN_PROGRESS'
  /** The creative failed to render (image download, video playback, HTML). */
  | 'CREATIVE_FAILED'
  /** The app is marked child-directed; Adfacten does not serve such traffic. */
  | 'CHILD_DIRECTED'
  /** Anything else, including a missing native module. */
  | 'INTERNAL_ERROR';

/**
 * Machine codes the ad server sends with `REJECTED` errors. Other values may be added later,
 * so treat this as an open set.
 */
export type AdfactenServerCode =
  | 'unknown_app'
  | 'app_not_approved'
  | 'bundle_mismatch'
  | 'platform_mismatch'
  | 'placement_mismatch'
  | 'coppa'
  | 'test_only'
  | 'invalid_request'
  | (string & {});

const KNOWN_CODES: ReadonlySet<string> = new Set<AdfactenErrorCode>([
  'NOT_INITIALIZED',
  'INVALID_REQUEST',
  'NETWORK_ERROR',
  'NO_FILL',
  'SERVER_ERROR',
  'INVALID_RESPONSE',
  'REJECTED',
  'AD_EXPIRED',
  'NOT_READY',
  'SHOW_FAILED',
  'VIDEO_NOT_SUPPORTED',
  'LOAD_IN_PROGRESS',
  'CREATIVE_FAILED',
  'CHILD_DIRECTED',
  'INTERNAL_ERROR',
]);

export class AdfactenError extends Error {
  readonly code: AdfactenErrorCode;
  /**
   * The stable error name reported by the native SDK (`no_fill`, `network_error`, `rejected`,
   * ...), the same on Android and iOS. Errors raised in JS use the lower-case code.
   */
  readonly errorName: string;
  /** The ad server's code for `REJECTED` errors, e.g. `bundle_mismatch`. */
  readonly serverCode?: AdfactenServerCode;
  /** The platform SDK's numeric error code, for bug reports. */
  readonly nativeCode?: number;

  constructor(
    code: AdfactenErrorCode,
    message: string,
    serverCode?: string,
    nativeCode?: number,
    errorName?: string
  ) {
    super(message);
    this.name = 'AdfactenError';
    this.code = code;
    this.errorName = errorName || code.toLowerCase();
    if (serverCode) this.serverCode = serverCode;
    if (typeof nativeCode === 'number') this.nativeCode = nativeCode;
  }

  override toString(): string {
    const server = this.serverCode ? ` (${this.serverCode})` : '';
    return `AdfactenError[${this.code}]${server}: ${this.message}`;
  }
}

export function isAdfactenError(e: unknown): e is AdfactenError {
  return e instanceof AdfactenError;
}

/** Maps a native error name (`no_fill`) or a code (`NO_FILL`) to an AdfactenErrorCode. */
export function normalizeCode(code: unknown): AdfactenErrorCode {
  if (typeof code !== 'string') return 'INTERNAL_ERROR';
  const upper = code.toUpperCase();
  if (upper === 'ALREADY_SHOWN') return 'NOT_READY';
  return KNOWN_CODES.has(upper)
    ? (upper as AdfactenErrorCode)
    : 'INTERNAL_ERROR';
}

type ErrorFields = {
  code?: unknown;
  message?: unknown;
  serverCode?: unknown;
  nativeCode?: unknown;
};

/** Builds an AdfactenError from an error event payload (empty strings mean "none"). */
export function errorFromEvent(e: ErrorFields): AdfactenError {
  return new AdfactenError(
    normalizeCode(e.code),
    typeof e.message === 'string' && e.message ? e.message : 'unknown error',
    typeof e.serverCode === 'string' && e.serverCode ? e.serverCode : undefined,
    typeof e.nativeCode === 'number' ? e.nativeCode : undefined,
    typeof e.code === 'string' && e.code ? e.code.toLowerCase() : undefined
  );
}

/** Converts a rejected native promise into an AdfactenError. */
export function errorFromRejection(e: unknown): AdfactenError {
  if (e instanceof AdfactenError) return e;
  const err = (e ?? {}) as ErrorFields & { userInfo?: Record<string, unknown> };
  const info = err.userInfo ?? {};
  return errorFromEvent({
    code: err.code,
    message: err.message,
    serverCode: info.serverCode,
    nativeCode: info.nativeCode,
  });
}
