import {
  codegenNativeComponent,
  type CodegenTypes,
  type HostComponent,
  type ViewProps,
} from 'react-native';

export type NativeErrorEvent = Readonly<{
  code: string;
  message: string;
  serverCode: string;
  nativeCode: CodegenTypes.Int32;
}>;

export interface NativeProps extends ViewProps {
  placementId: string;
  /** banner | largeBanner | mediumRectangle | leaderboard */
  size?: CodegenTypes.WithDefault<string, 'banner'>;
  autoRefresh?: CodegenTypes.WithDefault<boolean, true>;
  onAdLoaded?: CodegenTypes.DirectEventHandler<Readonly<{}>>;
  onAdFailedToLoad?: CodegenTypes.DirectEventHandler<NativeErrorEvent>;
  onAdImpression?: CodegenTypes.DirectEventHandler<Readonly<{}>>;
  onAdClicked?: CodegenTypes.DirectEventHandler<Readonly<{}>>;
}

export default codegenNativeComponent<NativeProps>(
  'RNAdfactenBannerView'
) as HostComponent<NativeProps>;
