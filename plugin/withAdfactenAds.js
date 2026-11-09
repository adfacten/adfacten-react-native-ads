// Expo config plugin for @adfacten/react-native-ads. Runs during `npx expo prebuild`.
const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withGradleProperties,
  withInfoPlist,
} = require('expo/config-plugins');

const pkg = require('../package.json');

const AD_ID_PERMISSION = 'com.google.android.gms.permission.AD_ID';

/**
 * @typedef {object} AdfactenPluginOptions
 * @property {boolean} [androidAdvertisingId=true] Include the Google advertising ID module and its
 *   AD_ID permission. Set to false for child-directed apps or if you don't want the permission.
 * @property {boolean} [androidVideo=true] Include VAST video support (Media3) for interstitial and
 *   rewarded ads.
 * @property {string} [userTrackingUsageDescription] iOS `NSUserTrackingUsageDescription`. Only
 *   needed if your app asks for App Tracking Transparency permission.
 */

function setGradleProperty(properties, key, value) {
  const existing = properties.find(
    (p) => p.type === 'property' && p.key === key
  );
  if (existing) {
    existing.value = value;
  } else {
    properties.push({ type: 'property', key, value });
  }
  return properties;
}

function setAdIdPermission(manifest, include) {
  const root = manifest.manifest;
  const permissions = (root['uses-permission'] ?? []).filter(
    (p) => p.$['android:name'] !== AD_ID_PERMISSION
  );
  if (!include) {
    AndroidConfig.Manifest.ensureToolsAvailable(manifest);
    // ads-gaid is left out, but another library may still merge the permission in.
    permissions.push({
      $: { 'android:name': AD_ID_PERMISSION, 'tools:node': 'remove' },
    });
  }
  root['uses-permission'] = permissions;
  return manifest;
}

/** @type {import('expo/config-plugins').ConfigPlugin<AdfactenPluginOptions | void>} */
const withAdfactenAds = (config, options) => {
  const opts = options ?? {};
  const advertisingId = opts.androidAdvertisingId !== false;
  const video = opts.androidVideo !== false;

  config = withGradleProperties(config, (c) => {
    setGradleProperty(
      c.modResults,
      'adfactenAdvertisingId',
      String(advertisingId)
    );
    setGradleProperty(c.modResults, 'adfactenVideo', String(video));
    return c;
  });

  config = withAndroidManifest(config, (c) => {
    c.modResults = setAdIdPermission(c.modResults, advertisingId);
    return c;
  });

  if (opts.userTrackingUsageDescription) {
    config = withInfoPlist(config, (c) => {
      c.modResults.NSUserTrackingUsageDescription =
        opts.userTrackingUsageDescription;
      return c;
    });
  }

  return config;
};

module.exports = createRunOncePlugin(withAdfactenAds, pkg.name, pkg.version);
module.exports.setGradleProperty = setGradleProperty;
module.exports.setAdIdPermission = setAdIdPermission;
