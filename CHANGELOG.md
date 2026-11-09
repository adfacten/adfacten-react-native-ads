# Changelog

## 1.0.1 - 2026-11-09

- Built on the native Adfacten SDK 1.0.2: Android `com.adfacten:ads` 1.0.2, iOS AdfactenAds 1.0.2
  (XCFramework checksum updated).
- Banners retry by themselves after a failed load while they are on screen.
- `autoRefresh` now works the same on both platforms: left on (the default), the placement's
  interval applies; `false` turns refresh off even if the placement has one.
- Showing a native ad again never counts a second impression.
- New `AdfactenError.errorName`: the native SDK's stable error name (`no_fill`, `rejected`, ...),
  the same on Android and iOS. `code` is derived from it; existing codes are unchanged.
- The package reports itself to the SDK (`react_native` and the package version), sent with ad
  requests. New `Adfacten.version`.

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
