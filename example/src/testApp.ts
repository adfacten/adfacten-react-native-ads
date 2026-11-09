import { Platform } from 'react-native';

/**
 * Adfacten's public test apps. They always receive test ads (never billed) and only work with
 * the bundle id / applicationId `com.adfacten.sample`. Use your own keys from the panel in your app.
 */
export const TEST_APP = Platform.select({
  ios: {
    appKey: 'apk_r2FjVF7YUGb3ITZZUt6ENHH1',
    banner: 'plc_034uZ7K268zGmUPhbl0LgL',
    interstitial: 'plc_034uZ7K26J5FvjnFBJjThJ',
    rewarded: 'plc_034uZ7K2CBEP9L6EQszuIk',
    native: 'plc_034uZ7K2I1fWOEzDnkJpwt',
    appOpen: 'plc_034uZ7K2IBiNmiy9FGrHNe',
  },
  default: {
    appKey: 'apk_3cnu84fqX8ucMX9XPyeQYHrR',
    banner: 'plc_034uZ7K1c31r4F5eyGyUpC',
    interstitial: 'plc_034uZ7K1i1xnu0Ksljnmy4',
    rewarded: 'plc_034uZ7K1nrWgf7S5ATCLrI',
    native: 'plc_034uZ7K1o0SSewGeBCGY9P',
    appOpen: 'plc_034uZ7K1o901BKzbEbWDjK',
  },
});
