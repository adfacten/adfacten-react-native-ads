# Adfacten Ads for React Native

Banner, interstitial, rewarded, app-open and native ads from the Adfacten network, for React Native
and Expo apps on Android and iOS.

This package wraps the native Adfacten SDKs (`com.adfacten:ads` for Android, `AdfactenAds` for iOS).
Ad requests, rendering, viewability, click handling and consent all run in the native SDKs; the
JavaScript layer only forwards calls and events.

- React Native 0.80 or newer with the New Architecture (the default since 0.76, the only option since 0.82)
- iOS 15.1+, Android 7.0+ (minSdk 24)
- Expo: development builds and `expo prebuild` (not Expo Go)

## Installation

The package is not on npm yet. Install it from GitHub:

```sh
npm install github:adfacten/adfacten-react-native-ads#v1.0.0
# or
yarn add @adfacten/react-native-ads@github:adfacten/adfacten-react-native-ads#v1.0.0
```

iOS:

```sh
cd ios && pod install
```

`pod install` downloads the AdfactenAds XCFramework from `cdn.adfacten.com`, checks its SHA-256 and
links it. Nothing to add to your Podfile. See [iOS SDK linking](#ios-sdk-linking) for other options.

Android needs no changes: the package adds Adfacten's Maven repository
(`https://cdn.adfacten.com/maven/`, limited to the `com.adfacten` group) to your Gradle projects.
If your `settings.gradle` locks repositories with `RepositoriesMode.FAIL_ON_PROJECT_REPOS`, add it there:

```groovy
dependencyResolutionManagement {
  repositories {
    google()
    mavenCentral()
    maven { url "https://cdn.adfacten.com/maven/" }
  }
}
```

Rebuild the app after installing (`npx react-native run-android` / `run-ios`, or a new dev build).

## Initialize

Call `initialize` once, before the first ad request, for example at the top of your entry file.
Android and iOS apps have separate app keys in the Adfacten panel (*Apps*).

```tsx
import { Platform } from 'react-native';
import { Adfacten } from '@adfacten/react-native-ads';

Adfacten.initialize(
  Platform.select({ ios: 'apk_your_ios_key', default: 'apk_your_android_key' }),
  { testMode: __DEV__ }
);
```

| Option | Default | |
|---|---|---|
| `testMode` | `false` | Request test ads. Never billed. |
| `logLevel` | `'warning'` | `'none' \| 'error' \| 'warning' \| 'info' \| 'debug'`. Logcat tag `Adfacten`, iOS subsystem `com.adfacten.ads`. |
| `childDirected` | `false` | COPPA / Families. See [Privacy](#privacy-and-consent). |
| `userId` | none | Your user id for rewarded server callbacks. Change it later with `Adfacten.setUserId(id)` (or `null` to clear). |

`Adfacten.getSdkVersion()` resolves to the native SDK version.

## Banner

```tsx
import { AdfactenBanner } from '@adfacten/react-native-ads';

<AdfactenBanner
  placementId="plc_your_banner"
  size="banner"
  onLoad={() => {}}
  onError={(e) => console.log(e.code, e.message)}
  onImpression={() => {}}
  onClick={() => {}}
/>
```

| `size` | dp / pt |
|---|---|
| `banner` (default) | 320x50 |
| `largeBanner` | 320x100 |
| `mediumRectangle` | 300x250 |
| `leaderboard` | 728x90, tablets |

The component has the size of the creative; use `style` for margins and alignment. The ad loads when
the view mounts and is released when it unmounts. Impressions count only while the banner is really
on screen, and it refreshes on its own at the interval set on the placement (30-120 s of on-screen
time). Set `autoRefresh={false}` to turn refresh off (on iOS an interval set on the placement still
applies). Changing `placementId` or `size` loads a new ad.

## Interstitial

```tsx
import { InterstitialAd } from '@adfacten/react-native-ads';

const ad = await InterstitialAd.load('plc_your_interstitial');
ad.addListener('closed', () => {
  // Resume the app, load the next ad.
});
await ad.show();
```

Full-screen ads (interstitial, rewarded, app open) share the same API:

- `load(placementId)` resolves with a loaded ad or rejects with an [`AdfactenError`](#errors).
- `show()` resolves once the ad is on screen, or rejects (`AD_EXPIRED`, `NOT_READY`, `SHOW_FAILED`, ...).
- Events: `shown`, `clicked`, `closed`, `failedToShow`. `addListener` returns `{ remove() }`.
  After `shown`, `closed` always follows, even if playback fails.
- `isReady`, `isExpired`, `placementId`, `loadedAt`.
- An ad can be shown once and is valid for about 55 minutes. Load close to when you show it.
- `destroy()` releases an ad you decided not to show. Shown ads clean up after `closed`.

## Rewarded

```tsx
import { RewardedAd } from '@adfacten/react-native-ads';

const ad = await RewardedAd.load('plc_your_rewarded', { customData: 'level=3' });
console.log(ad.reward); // { type: 'coins', amount: 10 } as set on the placement, or null

await ad.show({
  onUserEarnedReward: (reward) => {
    // UX only, e.g. show "+10 coins". Credit the user from your server callback.
  },
});
```

`customData` (up to 256 characters) and the user id from `initialize` / `setUserId` are passed to
your reward callback. The same reward is also delivered to `addListener('userEarnedReward', ...)`.

**Don't grant value from `onUserEarnedReward`.** It runs on the device. After a valid completion,
Adfacten calls the reward callback URL you set in the panel:

```
GET https://your.server/reward?user_id=...&custom=...&reward_type=coins&reward_amount=10
    &transaction_id=<impression id>&placement=plc_...&ts=<unix>[&test=1]&sig=<hex>
```

`sig` is `HMAC-SHA256(reward secret, raw query string up to &sig=)`. Verify it, store
`transaction_id` to ignore repeats, skip `test=1` in production and answer with a 2xx.

```js
const crypto = require('crypto');
function verify(rawQuery, secret) {
  const i = rawQuery.lastIndexOf('&sig=');
  const expected = crypto.createHmac('sha256', secret).update(rawQuery.slice(0, i)).digest('hex');
  const sig = rawQuery.slice(i + 5);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
```

## App open

Load ahead of time and show the ad when the user comes back to the app:

```tsx
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { AppOpenAd } from '@adfacten/react-native-ads';

function useAppOpenAd(placementId: string) {
  const ad = useRef<AppOpenAd | null>(null);

  useEffect(() => {
    const load = () =>
      AppOpenAd.load(placementId).then(
        (loaded) => {
          loaded.addListener('closed', load);
          ad.current = loaded;
        },
        () => {} // no fill or offline: try again on the next foreground
      );
    load();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (ad.current?.isReady) ad.current.show().catch(() => {});
      else if (!ad.current || ad.current.isExpired) load();
    });
    return () => sub.remove();
  }, [placementId]);
}
```

Don't keep the user waiting on a splash screen for an ad.

## Native

```tsx
import { AdfactenNativeAd } from '@adfacten/react-native-ads';

<AdfactenNativeAd
  placementId="plc_your_native"
  template="medium"
  appearance={{
    titleColor: '#111111',
    callToActionColor: '#1a73e8',
    callToActionTextColor: '#ffffff',
    callToActionCornerRadius: 8,
  }}
  style={{ backgroundColor: '#fff', borderRadius: 8 }}
  onLoad={(assets) => console.log(assets.title)}
  onError={(e) => {}}
/>
```

Templates:

- `medium` (default): icon, title, "Ad" badge and advertiser, text, main image at its aspect ratio
  and a full-width button. Good for feeds.
- `small`: icon, title, text and a button in one row, under 100 dp high. Good for lists.

`appearance` accepts `titleColor`, `bodyColor`, `secondaryColor`, `callToActionColor`,
`callToActionTextColor`, `adLabelColor`, `titleFontSize`, `bodyFontSize`, `callToActionCornerRadius`
and `mediaCornerRadius`. The background, border and margins come from `style`.

The width comes from your layout (give it at least 280 dp). The view is 0 high until an ad is
loaded, then takes the height the template needs, so a slot without fill takes no space. Set a
`height` in `style` to override it. Colors can change at any time; changing `template` after the ad
loaded rebuilds the view.

Why a native template instead of laying out the assets in React components: the SDK has to measure
the ad's real on-screen visibility and own the tap handling for impressions and clicks to be
counted correctly. React Native views are owned and re-rendered by React and handle touches in JS,
so the bridge would have to guess which native views make up the ad and keep that mapping in sync
through every re-render, scroll and recycle. Rendering the template natively inside the SDK's
`NativeAdView` keeps tracking exact and the integration a one-liner. `onLoad` still gives you the
text assets for logging.

## Errors

Every failure is an `AdfactenError` (`instanceof Error`), with the same codes on both platforms:

```ts
import { isAdfactenError } from '@adfacten/react-native-ads';

try {
  await InterstitialAd.load(placementId);
} catch (e) {
  if (isAdfactenError(e) && e.code === 'NO_FILL') {
    // no ad right now
  }
}
```

| `code` | Meaning |
|---|---|
| `NO_FILL` | No ad right now. The SDK waits at least 30 s before asking again for that placement. |
| `NETWORK_ERROR` | Offline or timeout. |
| `REJECTED` | The ad server refused the request; see `serverCode`. |
| `NOT_INITIALIZED` | `Adfacten.initialize` was not called, or the app key is malformed. |
| `INVALID_REQUEST` | For example an empty placement id. |
| `AD_EXPIRED` | Loaded about 55 minutes ago or more. Load a new one. |
| `NOT_READY` | Already shown, destroyed, or not loaded. |
| `SHOW_FAILED` | No foreground activity / view controller, or another ad is on screen. |
| `VIDEO_NOT_SUPPORTED` | A video ad was served but Android video support is turned off. |
| `CREATIVE_FAILED` | The creative failed to render (iOS). |
| `CHILD_DIRECTED` | The app is child-directed; ads are not served (iOS). |
| `LOAD_IN_PROGRESS`, `SERVER_ERROR`, `INVALID_RESPONSE`, `INTERNAL_ERROR` | Other failures. |

`serverCode` for `REJECTED`: `unknown_app` (wrong app key), `app_not_approved`, `bundle_mismatch`
(the bundle id / applicationId is not the one registered for the app), `platform_mismatch` (the
other platform's app key), `placement_mismatch` (the placement belongs to another app or format),
`coppa`, `test_only`. `nativeCode` holds the platform SDK's numeric code for bug reports.

## Expo

Expo Go cannot load native modules, so this package does not work in Expo Go. Use a
[development build](https://docs.expo.dev/develop/development-builds/introduction/) or `npx expo prebuild`.

Add the config plugin to `app.json` / `app.config.js`:

```json
{
  "expo": {
    "plugins": [
      [
        "@adfacten/react-native-ads",
        {
          "androidAdvertisingId": true,
          "androidVideo": true,
          "userTrackingUsageDescription": "Your data will be used to show you more relevant ads."
        }
      ]
    ]
  }
}
```

| Option | Default | |
|---|---|---|
| `androidAdvertisingId` | `true` | Include Google advertising ID / App Set ID support and the `AD_ID` permission. `false` leaves the module out and removes the permission (child-directed apps, or if you don't declare it in Play Console). |
| `androidVideo` | `true` | VAST video for interstitial and rewarded ads (Media3 ExoPlayer). |
| `userTrackingUsageDescription` | none | Sets `NSUserTrackingUsageDescription`. Needed only if you ask for App Tracking Transparency permission. |

Then `npx expo prebuild` (or `eas build`). The plugin is optional: without it the defaults apply.

## Privacy and consent

- **GDPR / TCF v2, GPP, US Privacy:** the native SDKs read the IAB strings your CMP stores
  (`IABTCF_*`, `IABGPP_*`, `IABUSPrivacy_String`) from `SharedPreferences` / `NSUserDefaults`. Show
  your CMP before loading ads. When GDPR applies without Purpose 1 consent, no advertising ID is sent.
- **iOS App Tracking Transparency:** the SDK never shows the ATT prompt. If you ask for it (for
  example with `expo-tracking-transparency`) and the user allows tracking, the IDFA is used;
  otherwise the IDFV or a per-install id. Add `NSUserTrackingUsageDescription` if you ask.
  SKAdNetwork is not used yet, so no `SKAdNetworkItems` are needed.
- **Android advertising ID:** read through `com.adfacten:ads-gaid` (included by default, adds the
  `AD_ID` permission). Limit ad tracking and zeroed IDs are respected.
- **Children:** set `childDirected: true` for child-directed apps or users. The SDKs then never
  read device advertising IDs and flag the request; Adfacten does not serve ads to such traffic.
  For Families apps also turn the advertising ID module off (`androidAdvertisingId: false` or
  `adfactenAdvertisingId=false`).
- Clicks open in the browser or the store, never inside your app.
- **Store disclosures:** the iOS SDK ships a privacy manifest. For the Google Play Data safety form,
  the SDK collects device or other IDs, approximate location (from the IP address) and ad
  interactions, shared with Adfacten for advertising and fraud prevention, encrypted in transit;
  user IDs only if you set `userId`.

## Test mode

Use `testMode: true` (or `__DEV__`) while integrating. Test ads look and track like real ones but are
never billed. New apps receive test ads until they are approved and app-ads.txt is verified, and
emulators and simulators always get test ads. Turn `testMode` off for release builds.

The [example app](example) uses Adfacten's public test apps, which always serve test ads. Their
keys only work with the bundle id / applicationId `com.adfacten.sample`.

## Android build options

Set in your app's `android/gradle.properties` (the Expo plugin does this for you):

| Property | Default | |
|---|---|---|
| `adfactenVideo` | `true` | Include `com.adfacten:ads-video`. |
| `adfactenAdvertisingId` | `true` | Include `com.adfacten:ads-gaid` (and the `AD_ID` permission). |

To use another native SDK version, set `adfactenSdkVersion` in the root `build.gradle` `ext` block.
The AARs ship their own R8 / ProGuard rules.

## iOS SDK linking

By default the pod vendors the XCFramework downloaded from the Adfacten CDN during `pod install`
(cached in the package's `ios/Frameworks`). Alternatives, set as environment variables for
`pod install`:

- `ADFACTEN_IOS_SDK=pod`: depend on the `AdfactenAds` pod built from source instead. Add it to your
  Podfile, since it is not on CocoaPods trunk:

  ```ruby
  pod 'AdfactenAds', :git => 'https://github.com/adfacten/adfacten-ios-sdk.git', :tag => '1.0.0'
  ```

- `ADFACTEN_IOS_FRAMEWORK=/path/to/AdfactenAds.xcframework`: use a copy you downloaded yourself,
  for offline or locked-down CI builds.

## Example app

`example/` shows every format. See [example/README.md](example/README.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).
