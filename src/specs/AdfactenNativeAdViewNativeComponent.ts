import {
  codegenNativeComponent,
  type CodegenTypes,
  type ColorValue,
  type HostComponent,
  type ViewProps,
} from 'react-native';

export type NativeErrorEvent = Readonly<{
  code: string;
  message: string;
  serverCode: string;
  nativeCode: CodegenTypes.Int32;
}>;

export type NativeAdLoadedEvent = Readonly<{
  title: string;
  body: string;
  brand: string;
  callToAction: string;
  adLabel: string;
}>;

export interface NativeProps extends ViewProps {
  placementId: string;
  /** small | medium */
  templateType?: CodegenTypes.WithDefault<string, 'medium'>;
  titleColor?: ColorValue;
  bodyColor?: ColorValue;
  secondaryColor?: ColorValue;
  callToActionColor?: ColorValue;
  callToActionTextColor?: ColorValue;
  adLabelColor?: ColorValue;
  titleFontSize?: CodegenTypes.WithDefault<CodegenTypes.Float, 0>;
  bodyFontSize?: CodegenTypes.WithDefault<CodegenTypes.Float, 0>;
  callToActionCornerRadius?: CodegenTypes.WithDefault<CodegenTypes.Float, -1>;
  mediaCornerRadius?: CodegenTypes.WithDefault<CodegenTypes.Float, -1>;
  onAdLoaded?: CodegenTypes.DirectEventHandler<NativeAdLoadedEvent>;
  onAdFailedToLoad?: CodegenTypes.DirectEventHandler<NativeErrorEvent>;
  onAdImpression?: CodegenTypes.DirectEventHandler<Readonly<{}>>;
  onAdClicked?: CodegenTypes.DirectEventHandler<Readonly<{}>>;
  /** The height (dp/pt) the template needs at the current width. */
  onAdLayout?: CodegenTypes.DirectEventHandler<
    Readonly<{ height: CodegenTypes.Double }>
  >;
}

export default codegenNativeComponent<NativeProps>(
  'RNAdfactenNativeAdView'
) as HostComponent<NativeProps>;
