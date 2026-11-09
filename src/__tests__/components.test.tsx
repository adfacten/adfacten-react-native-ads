import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

jest.mock('../specs/AdfactenBannerViewNativeComponent', () => ({
  __esModule: true,
  default: 'RNAdfactenBannerView',
}));
jest.mock('../specs/AdfactenNativeAdViewNativeComponent', () => ({
  __esModule: true,
  default: 'RNAdfactenNativeAdView',
}));

import { AdfactenBanner } from '../AdfactenBanner';
import { AdfactenNativeAd } from '../AdfactenNativeAd';
import { AdfactenError } from '../errors';

function render(element: React.ReactElement): ReactTestRenderer {
  let r: ReactTestRenderer;
  act(() => {
    r = create(element);
  });
  return r!;
}

function host(r: ReactTestRenderer, type: string) {
  return r.root.findByType(type as unknown as React.ElementType);
}

/** The View that wraps the native ad view. */
function container(r: ReactTestRenderer) {
  return host(r, 'RNAdfactenNativeAdView').parent!;
}

describe('AdfactenBanner', () => {
  it('sizes itself from the banner size', () => {
    const r = render(
      <AdfactenBanner
        placementId="plc_b"
        size="mediumRectangle"
        style={{ marginTop: 8, width: 999 }}
      />
    );
    const view = host(r, 'RNAdfactenBannerView');
    const style = StyleSheet.flatten(view.props.style);
    expect(view.props.placementId).toBe('plc_b');
    expect(view.props.size).toBe('mediumRectangle');
    expect(view.props.autoRefresh).toBe(true);
    expect(style).toMatchObject({ width: 300, height: 250, marginTop: 8 });
  });

  it('falls back to the standard banner for an unknown size', () => {
    const r = render(
      <AdfactenBanner placementId="plc_b" size={'huge' as never} />
    );
    const view = host(r, 'RNAdfactenBannerView');
    expect(view.props.size).toBe('banner');
    expect(StyleSheet.flatten(view.props.style)).toMatchObject({
      width: 320,
      height: 50,
    });
  });

  it('turns native events into callbacks', () => {
    const onLoad = jest.fn();
    const onError = jest.fn();
    const onImpression = jest.fn();
    const onClick = jest.fn();
    const r = render(
      <AdfactenBanner
        placementId="plc_b"
        onLoad={onLoad}
        onError={onError}
        onImpression={onImpression}
        onClick={onClick}
      />
    );
    const view = host(r, 'RNAdfactenBannerView');
    act(() => {
      view.props.onAdLoaded({ nativeEvent: {} });
      view.props.onAdImpression({ nativeEvent: {} });
      view.props.onAdClicked({ nativeEvent: {} });
      view.props.onAdFailedToLoad({
        nativeEvent: {
          code: 'NO_FILL',
          message: 'no ad',
          serverCode: '',
          nativeCode: 4,
        },
      });
    });
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onImpression).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0];
    expect(err).toBeInstanceOf(AdfactenError);
    expect(err.code).toBe('NO_FILL');
    expect(err.serverCode).toBeUndefined();
  });

  it('does not subscribe to events nobody listens to', () => {
    const r = render(<AdfactenBanner placementId="plc_b" />);
    const view = host(r, 'RNAdfactenBannerView');
    expect(view.props.onAdClicked).toBeUndefined();
    expect(view.props.onAdFailedToLoad).toBeUndefined();
  });
});

describe('AdfactenNativeAd', () => {
  it('stays collapsed until the template is measured', () => {
    const r = render(<AdfactenNativeAd placementId="plc_n" />);
    let view = host(r, 'RNAdfactenNativeAdView');
    expect(view.props.templateType).toBe('medium');
    expect(StyleSheet.flatten(view.props.style).height).toBe(0);
    act(() => view.props.onAdLayout({ nativeEvent: { height: 311.4 } }));
    view = host(r, 'RNAdfactenNativeAdView');
    expect(StyleSheet.flatten(view.props.style).height).toBe(312);
  });

  it('keeps a height set by the app', () => {
    const r = render(
      <AdfactenNativeAd
        placementId="plc_n"
        template="small"
        style={{ height: 120 }}
      />
    );
    const view = host(r, 'RNAdfactenNativeAdView');
    act(() => view.props.onAdLayout({ nativeEvent: { height: 96 } }));
    const native = host(r, 'RNAdfactenNativeAdView');
    expect(StyleSheet.flatten(native.props.style)).toEqual({ flex: 1 });
    expect(StyleSheet.flatten(container(r).props.style).height).toBe(120);
    expect(native.props.templateType).toBe('small');
  });

  it('puts the app style on a container and collapses it until filled', () => {
    const r = render(
      <AdfactenNativeAd
        placementId="plc_n"
        testID="ad"
        style={{ marginTop: 12, borderWidth: 1, borderRadius: 8 }}
      />
    );
    let outer = StyleSheet.flatten(container(r).props.style);
    expect(container(r).props.testID).toBe('ad');
    expect(outer).toMatchObject({
      height: 0,
      marginTop: 0,
      borderWidth: 0,
      borderRadius: 8,
    });
    act(() =>
      host(r, 'RNAdfactenNativeAdView').props.onAdLayout({
        nativeEvent: { height: 150 },
      })
    );
    outer = StyleSheet.flatten(container(r).props.style);
    expect(outer).toMatchObject({ marginTop: 12, borderWidth: 1 });
    expect(outer.height).toBeUndefined();
  });

  it('passes appearance with sentinel defaults', () => {
    const r = render(
      <AdfactenNativeAd
        placementId="plc_n"
        appearance={{
          titleColor: '#fff',
          callToActionCornerRadius: 0,
          titleFontSize: 18,
        }}
      />
    );
    const view = host(r, 'RNAdfactenNativeAdView');
    expect(view.props.titleColor).toBe('#fff');
    expect(view.props.callToActionCornerRadius).toBe(0);
    expect(view.props.mediaCornerRadius).toBe(-1);
    expect(view.props.titleFontSize).toBe(18);
    expect(view.props.bodyFontSize).toBe(0);
  });

  it('reports assets and collapses on error', () => {
    const onLoad = jest.fn();
    const onError = jest.fn();
    const r = render(
      <AdfactenNativeAd placementId="plc_n" onLoad={onLoad} onError={onError} />
    );
    const view = host(r, 'RNAdfactenNativeAdView');
    const assets = {
      title: 'T',
      body: 'B',
      brand: 'Br',
      callToAction: 'Go',
      adLabel: 'Ad',
    };
    act(() => {
      view.props.onAdLayout({ nativeEvent: { height: 200 } });
      view.props.onAdLoaded({ nativeEvent: assets });
    });
    expect(onLoad).toHaveBeenCalledWith(assets);
    act(() =>
      host(r, 'RNAdfactenNativeAdView').props.onAdFailedToLoad({
        nativeEvent: {
          code: 'NETWORK_ERROR',
          message: 'offline',
          serverCode: '',
          nativeCode: 3,
        },
      })
    );
    expect(onError.mock.calls[0][0].code).toBe('NETWORK_ERROR');
    expect(
      StyleSheet.flatten(host(r, 'RNAdfactenNativeAdView').props.style).height
    ).toBe(0);
  });
});
