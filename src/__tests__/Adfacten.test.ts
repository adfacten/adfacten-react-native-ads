import { createNativeMock, type NativeMock } from './nativeMock';

let mockNative: NativeMock | null;

jest.mock('../specs/NativeAdfactenAds', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
}));

import { Adfacten } from '../Adfacten';
import { InterstitialAd } from '../FullScreenAd';

beforeEach(() => {
  mockNative = createNativeMock();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('Adfacten', () => {
  it('initializes with only the options that were set', () => {
    Adfacten.initialize(' apk_abc ', { testMode: true, logLevel: 'debug' });
    expect(mockNative!.initialize).toHaveBeenCalledWith('apk_abc', {
      testMode: true,
      logLevel: 'debug',
      pluginVersion: Adfacten.version,
    });
    expect(Adfacten.isInitialized()).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('passes childDirected and userId', () => {
    Adfacten.initialize('apk_abc', {
      childDirected: true,
      userId: 'u'.repeat(300),
    });
    const config = mockNative!.initialize.mock.calls[0]![1] as {
      childDirected: boolean;
      userId: string;
    };
    expect(config.childDirected).toBe(true);
    expect(config.userId).toHaveLength(256);
  });

  it('warns about a malformed app key but still forwards it', () => {
    Adfacten.initialize('plc_wrong');
    expect(console.warn).toHaveBeenCalled();
    expect(mockNative!.initialize).toHaveBeenCalledWith('plc_wrong', {
      pluginVersion: Adfacten.version,
    });
  });

  it('reports the package version from package.json', () => {
    const pkg = require('../../package.json') as { version: string };
    expect(Adfacten.version).toBe(pkg.version);
  });

  it('sets and clears the user id', () => {
    Adfacten.setUserId('user-1');
    Adfacten.setUserId(null);
    expect(mockNative!.setUserId.mock.calls).toEqual([['user-1'], [null]]);
  });

  it('returns the native SDK version', async () => {
    await expect(Adfacten.getSdkVersion()).resolves.toBe('1.0.0');
  });

  it('explains a missing native module (Expo Go, no rebuild)', async () => {
    mockNative = null;
    expect(() => Adfacten.initialize('apk_abc')).toThrow(/Expo Go/);
    await expect(InterstitialAd.load('plc_a')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
  });
});
