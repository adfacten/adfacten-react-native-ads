import {
  AdfactenError,
  errorFromEvent,
  errorFromRejection,
  isAdfactenError,
  normalizeCode,
} from '../errors';

describe('errors', () => {
  it('keeps known codes and maps unknown ones to INTERNAL_ERROR', () => {
    expect(normalizeCode('NO_FILL')).toBe('NO_FILL');
    expect(normalizeCode('REJECTED')).toBe('REJECTED');
    expect(normalizeCode('SOMETHING_NEW')).toBe('INTERNAL_ERROR');
    expect(normalizeCode(undefined)).toBe('INTERNAL_ERROR');
  });

  it('maps every native error name to a code', () => {
    const names: Record<string, string> = {
      internal_error: 'INTERNAL_ERROR',
      not_initialized: 'NOT_INITIALIZED',
      invalid_request: 'INVALID_REQUEST',
      network_error: 'NETWORK_ERROR',
      no_fill: 'NO_FILL',
      server_error: 'SERVER_ERROR',
      invalid_response: 'INVALID_RESPONSE',
      rejected: 'REJECTED',
      ad_expired: 'AD_EXPIRED',
      already_shown: 'NOT_READY',
      not_ready: 'NOT_READY',
      show_failed: 'SHOW_FAILED',
      video_not_supported: 'VIDEO_NOT_SUPPORTED',
      load_in_progress: 'LOAD_IN_PROGRESS',
      child_directed: 'CHILD_DIRECTED',
      creative_failed: 'CREATIVE_FAILED',
    };
    for (const [name, code] of Object.entries(names)) {
      expect(normalizeCode(name)).toBe(code);
      const e = errorFromEvent({ code: name, message: 'm' });
      expect(e.code).toBe(code);
      expect(e.errorName).toBe(name);
    }
  });

  it('keeps an unknown native name but reports INTERNAL_ERROR', () => {
    const e = errorFromEvent({ code: 'something_new', message: 'm' });
    expect(e.code).toBe('INTERNAL_ERROR');
    expect(e.errorName).toBe('something_new');
  });

  it('gives errors raised in JS the lower-case name', () => {
    expect(new AdfactenError('NOT_READY', 'x').errorName).toBe('not_ready');
  });

  it('builds errors from view events, treating empty strings as missing', () => {
    const e = errorFromEvent({
      code: 'NO_FILL',
      message: 'no ad',
      serverCode: '',
      nativeCode: 4,
    });
    expect(e).toBeInstanceOf(AdfactenError);
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('NO_FILL');
    expect(e.message).toBe('no ad');
    expect(e.serverCode).toBeUndefined();
    expect(e.nativeCode).toBe(4);
    expect(isAdfactenError(e)).toBe(true);
  });

  it('reads serverCode and nativeCode from a promise rejection', () => {
    const rejection = Object.assign(new Error('bundle id does not match'), {
      code: 'REJECTED',
      userInfo: { serverCode: 'bundle_mismatch', nativeCode: 7 },
    });
    const e = errorFromRejection(rejection);
    expect(e.code).toBe('REJECTED');
    expect(e.serverCode).toBe('bundle_mismatch');
    expect(e.nativeCode).toBe(7);
    expect(String(e)).toBe(
      'AdfactenError[REJECTED] (bundle_mismatch): bundle id does not match'
    );
  });

  it('passes AdfactenErrors through and copes with junk', () => {
    const original = new AdfactenError('NETWORK_ERROR', 'offline');
    expect(errorFromRejection(original)).toBe(original);
    const junk = errorFromRejection(null);
    expect(junk.code).toBe('INTERNAL_ERROR');
    expect(junk.message).toBe('unknown error');
    expect(isAdfactenError(new Error('x'))).toBe(false);
  });
});
