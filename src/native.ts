import { Platform } from 'react-native';
import NativeAdfactenAds, { type Spec } from './specs/NativeAdfactenAds';
import { AdfactenError } from './errors';

const LINKING_ERROR =
  `The native part of '@adfacten/react-native-ads' is not linked. ` +
  Platform.select({
    ios: "Run 'pod install' in the ios folder and rebuild the app. ",
    default: '',
  }) +
  'Rebuild the app after installing the package. Expo Go cannot load it: use a development build ' +
  "('npx expo run:android' / 'npx expo run:ios' or EAS Build).";

/** The TurboModule, or throws a readable error when the app was built without it. */
export function nativeModule(): Spec {
  if (NativeAdfactenAds == null) {
    throw new AdfactenError('INTERNAL_ERROR', LINKING_ERROR);
  }
  return NativeAdfactenAds;
}

export function isNativeModuleAvailable(): boolean {
  return NativeAdfactenAds != null;
}
