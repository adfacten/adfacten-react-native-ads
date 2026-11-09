# Changelog

## 1.0.0 - 2026-11-09

First release.

- `Adfacten.initialize`, `setUserId`, `getSdkVersion`.
- `AdfactenBanner` (320x50, 320x100, 300x250, 728x90) with load, error, impression and click events.
- `InterstitialAd`, `RewardedAd` (custom data, reward info, `onUserEarnedReward`) and `AppOpenAd`
  with promise-based `load` / `show` and event listeners.
- `AdfactenNativeAd`: native ad rendered by the platform SDK in a `small` or `medium` template,
  with colors, font sizes and corner radii you can set.
- `AdfactenError` with shared error codes on both platforms and the ad server's `serverCode`.
- New Architecture (TurboModule and Fabric components).
- Expo config plugin: Android advertising ID / AD_ID permission and video switches, iOS tracking
  usage description.
- Android pulls `com.adfacten:ads` 1.0.1 (plus `ads-video` and `ads-gaid` by default) from
  Adfacten's Maven repository; iOS vendors the AdfactenAds 1.0.0 XCFramework (checksum verified)
  or uses the AdfactenAds pod.
