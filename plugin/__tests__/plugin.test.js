const withAdfactenAds = require('../../app.plugin');
const { setAdIdPermission, setGradleProperty } = withAdfactenAds;

const AD_ID = 'com.google.android.gms.permission.AD_ID';

function manifest(permissions = []) {
  return {
    manifest: {
      '$': { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      'uses-permission': permissions.map((name) => ({
        $: { 'android:name': name },
      })),
    },
  };
}

describe('config plugin', () => {
  it('is a run-once plugin', () => {
    expect(typeof withAdfactenAds).toBe('function');
  });

  it('adds or replaces gradle properties', () => {
    const props = [{ type: 'property', key: 'adfactenVideo', value: 'true' }];
    setGradleProperty(props, 'adfactenVideo', 'false');
    setGradleProperty(props, 'adfactenAdvertisingId', 'true');
    expect(props).toEqual([
      { type: 'property', key: 'adfactenVideo', value: 'false' },
      { type: 'property', key: 'adfactenAdvertisingId', value: 'true' },
    ]);
  });

  it('removes the AD_ID permission when advertising ID is off', () => {
    const m = setAdIdPermission(
      manifest(['android.permission.INTERNET', AD_ID]),
      false
    );
    expect(m.manifest.$['xmlns:tools']).toBe(
      'http://schemas.android.com/tools'
    );
    expect(m.manifest['uses-permission']).toEqual([
      { $: { 'android:name': 'android.permission.INTERNET' } },
      { $: { 'android:name': AD_ID, 'tools:node': 'remove' } },
    ]);
  });

  it('leaves the permission to the SDK manifest when advertising ID is on', () => {
    const m = setAdIdPermission(manifest([AD_ID]), true);
    expect(m.manifest['uses-permission']).toEqual([]);
  });

  it('registers mods that set the gradle flags, manifest and Info.plist', async () => {
    const config = withAdfactenAds(
      { name: 'demo', slug: 'demo' },
      {
        androidAdvertisingId: false,
        androidVideo: false,
        userTrackingUsageDescription: 'Used to show relevant ads.',
      }
    );
    // Run each registered mod on in-memory results; no base mods, so nothing touches disk.
    const run = (platform, mod, modResults) =>
      config.mods[platform][mod]({
        ...config,
        modResults,
        modRequest: {
          platform,
          modName: mod,
          projectRoot: __dirname,
          platformProjectRoot: __dirname,
        },
      });

    const gradle = await run('android', 'gradleProperties', []);
    expect(gradle.modResults).toEqual([
      { type: 'property', key: 'adfactenAdvertisingId', value: 'false' },
      { type: 'property', key: 'adfactenVideo', value: 'false' },
    ]);
    const plist = await run('ios', 'infoPlist', {});
    expect(plist.modResults.NSUserTrackingUsageDescription).toBe(
      'Used to show relevant ads.'
    );
    const m = await run('android', 'manifest', manifest([AD_ID]));
    expect(m.modResults.manifest['uses-permission']).toEqual([
      { $: { 'android:name': AD_ID, 'tools:node': 'remove' } },
    ]);
  });

  it('only touches Info.plist when a usage description is given', () => {
    const config = withAdfactenAds({ name: 'demo', slug: 'demo' });
    expect(config.mods.ios).toBeUndefined();
    expect(Object.keys(config.mods.android).sort()).toEqual([
      'gradleProperties',
      'manifest',
    ]);
  });
});
