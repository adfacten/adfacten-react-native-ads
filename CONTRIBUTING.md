# Contributing

Bug reports and pull requests are welcome. For questions about your Adfacten account or panel,
write to destek@adfacten.com.

## Setup

The repository is a Yarn workspace: the library at the root and an example app in `example/`.
Use the Node version in `.nvmrc`, then:

```sh
yarn
```

JavaScript changes reach the example app through Metro without a rebuild; native changes need a
rebuild (`yarn example android`, or `pod install` and `yarn example ios`).

- Android sources: `android/src/main/java/com/adfacten/reactnative` (open `example/android` in Android Studio).
- iOS sources: `ios/` (open `example/ios/AdfactenAdsExample.xcworkspace`, then
  `Pods > Development Pods > AdfactenReactNativeAds`).
- Native specs for codegen: `src/specs`.

## Checks

```sh
yarn typecheck
yarn lint
yarn test
```

Please keep pull requests focused and add a test for behavior changes in the JS layer.
