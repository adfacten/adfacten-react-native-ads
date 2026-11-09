import { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  type ColorValue,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import NativeAdView, {
  type NativeAdLoadedEvent,
  type NativeErrorEvent,
} from './specs/AdfactenNativeAdViewNativeComponent';
import { AdfactenError, errorFromEvent } from './errors';

export type NativeAdTemplate = 'small' | 'medium';

/** Colors and sizes of the native template. Everything is optional. */
export type NativeAdAppearance = {
  titleColor?: ColorValue;
  bodyColor?: ColorValue;
  /** Brand name and other secondary text. */
  secondaryColor?: ColorValue;
  /** Background of the call-to-action button. */
  callToActionColor?: ColorValue;
  callToActionTextColor?: ColorValue;
  /** The "Ad" disclosure badge. */
  adLabelColor?: ColorValue;
  titleFontSize?: number;
  bodyFontSize?: number;
  callToActionCornerRadius?: number;
  mediaCornerRadius?: number;
};

/** The text assets of the loaded ad, for logging or analytics. */
export type NativeAdAssets = {
  title: string;
  body: string;
  brand: string;
  callToAction: string;
  adLabel: string;
};

export type AdfactenNativeAdProps = Omit<ViewProps, 'children'> & {
  /** The native placement (`plc_…`). Changing it loads a new ad. */
  placementId: string;
  /**
   * `small`: icon, title, text and button in a row (under 100 dp high).
   * `medium` (default): header, text, main image and a full-width button.
   */
  template?: NativeAdTemplate;
  appearance?: NativeAdAppearance;
  /**
   * Background, border, radius and margins of the ad's container; the template has its own
   * padding. The width comes from your layout and the height is measured natively unless you set
   * one. Until an ad is loaded the slot is collapsed (0 high, no vertical margin or border).
   */
  style?: StyleProp<ViewStyle>;
  onLoad?: (assets: NativeAdAssets) => void;
  onError?: (error: AdfactenError) => void;
  onImpression?: () => void;
  onClick?: () => void;
};

/**
 * A native ad rendered by the platform SDK in a template you can style. Rendering stays native so
 * the SDK measures viewability and handles clicks itself; React only sizes the view.
 */
export function AdfactenNativeAd({
  placementId,
  template = 'medium',
  appearance,
  style,
  onLoad,
  onError,
  onImpression,
  onClick,
  ...rest
}: AdfactenNativeAdProps) {
  const [height, setHeight] = useState(0);

  // The native view reports 0 while it (re)loads and the template height once an ad is bound.
  const handleLayout = useCallback(
    (e: NativeSyntheticEvent<Readonly<{ height: number }>>) => {
      const h = e.nativeEvent.height;
      if (Number.isFinite(h) && h >= 0) setHeight(Math.ceil(h));
    },
    []
  );
  const handleLoaded = useCallback(
    (e: NativeSyntheticEvent<NativeAdLoadedEvent>) => {
      const { title, body, brand, callToAction, adLabel } = e.nativeEvent;
      onLoad?.({ title, body, brand, callToAction, adLabel });
    },
    [onLoad]
  );
  const handleError = useCallback(
    (e: NativeSyntheticEvent<NativeErrorEvent>) => {
      setHeight(0);
      onError?.(errorFromEvent(e.nativeEvent));
    },
    [onError]
  );

  const a = appearance ?? {};
  const fixedHeight = StyleSheet.flatten(style)?.height !== undefined;
  // Until there is an ad, the slot takes no vertical space, including its border and spacing.
  const collapsed = !fixedHeight && height === 0;

  // The app's style goes on a plain View: React Native applies borders, radii and clipping
  // there on both platforms, while the native view inside only shows the template.
  return (
    <View {...rest} style={[styles.base, style, collapsed && styles.collapsed]}>
      <NativeAdView
        placementId={placementId}
        templateType={template === 'small' ? 'small' : 'medium'}
        titleColor={a.titleColor}
        bodyColor={a.bodyColor}
        secondaryColor={a.secondaryColor}
        callToActionColor={a.callToActionColor}
        callToActionTextColor={a.callToActionTextColor}
        adLabelColor={a.adLabelColor}
        titleFontSize={a.titleFontSize ?? 0}
        bodyFontSize={a.bodyFontSize ?? 0}
        callToActionCornerRadius={a.callToActionCornerRadius ?? -1}
        mediaCornerRadius={a.mediaCornerRadius ?? -1}
        style={fixedHeight ? styles.fill : { height }}
        onAdLayout={handleLayout}
        onAdLoaded={handleLoaded}
        onAdFailedToLoad={handleError}
        onAdImpression={onImpression ? () => onImpression() : undefined}
        onAdClicked={onClick ? () => onClick() : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', alignSelf: 'stretch' },
  fill: { flex: 1 },
  collapsed: {
    height: 0,
    borderWidth: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    margin: 0,
    marginVertical: 0,
    marginTop: 0,
    marginBottom: 0,
    padding: 0,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
});
