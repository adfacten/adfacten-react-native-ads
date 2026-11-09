import { useCallback } from 'react';
import {
  StyleSheet,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import NativeBannerView, {
  type NativeErrorEvent,
} from './specs/AdfactenBannerViewNativeComponent';
import { AdfactenError, errorFromEvent } from './errors';

export type BannerSize =
  'banner' | 'largeBanner' | 'mediumRectangle' | 'leaderboard';

/** Banner sizes in dp / points. Only these sizes are served. */
export const BannerSizes: Readonly<
  Record<BannerSize, { width: number; height: number }>
> = {
  banner: { width: 320, height: 50 },
  largeBanner: { width: 320, height: 100 },
  mediumRectangle: { width: 300, height: 250 },
  /** Tablets. */
  leaderboard: { width: 728, height: 90 },
};

export type AdfactenBannerProps = Omit<ViewProps, 'children' | 'style'> & {
  /** The banner placement (`plc_…`). Changing it loads a new ad. */
  placementId: string;
  /** Default `banner` (320x50). */
  size?: BannerSize;
  /**
   * Refresh with the interval set on the placement (30-120 s of on-screen time). Default true.
   * `false` turns refresh off, even if the placement has an interval.
   */
  autoRefresh?: boolean;
  /** Margins, alignment and similar. The size always comes from `size`. */
  style?: StyleProp<ViewStyle>;
  /** A creative was loaded (also after each refresh). */
  onLoad?: () => void;
  /**
   * No banner could be loaded. The banner retries by itself while it is on screen (not after a
   * rejection), so keep it mounted if you want the slot to fill later.
   */
  onError?: (error: AdfactenError) => void;
  /** The banner was on screen and the impression was recorded. */
  onImpression?: () => void;
  onClick?: () => void;
};

/**
 * A banner ad. The native SDK loads it as soon as it is mounted, counts the impression only
 * when it is really on screen, and refreshes it on its own.
 */
export function AdfactenBanner({
  placementId,
  size = 'banner',
  autoRefresh = true,
  style,
  onLoad,
  onError,
  onImpression,
  onClick,
  ...rest
}: AdfactenBannerProps) {
  const dims = BannerSizes[size] ?? BannerSizes.banner;
  const handleError = useCallback(
    (e: NativeSyntheticEvent<NativeErrorEvent>) =>
      onError?.(errorFromEvent(e.nativeEvent)),
    [onError]
  );
  return (
    <NativeBannerView
      {...rest}
      placementId={placementId}
      size={BannerSizes[size] ? size : 'banner'}
      autoRefresh={autoRefresh}
      style={[style, styles.fixed, dims]}
      onAdLoaded={onLoad ? () => onLoad() : undefined}
      onAdFailedToLoad={onError ? handleError : undefined}
      onAdImpression={onImpression ? () => onImpression() : undefined}
      onAdClicked={onClick ? () => onClick() : undefined}
    />
  );
}

const styles = StyleSheet.create({
  fixed: { flexGrow: 0, flexShrink: 0, overflow: 'hidden' },
});
