# Example app

Shows every ad format of `@adfacten/react-native-ads`: banner, interstitial, rewarded, app open and
native (both templates). It is preconfigured with Adfacten's public test apps, which always receive
test ads (never billed), so it works as is. The test apps are bound to the bundle id / applicationId
`com.adfacten.sample`; keep it unless you switch to your own keys in `src/testApp.ts`.

From the repository root:

```sh
yarn                               # install
yarn example start                 # Metro

yarn example android               # Android emulator or device
cd example/ios && pod install      # iOS, once
yarn example ios                   # iOS simulator
```

Event logs appear at the bottom of the screen. Native SDK logs: Logcat tag `Adfacten`, or the
`com.adfacten.ads` subsystem in Console.app.
