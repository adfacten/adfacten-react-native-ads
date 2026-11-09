#import "RNAdfactenBannerView.h"
#import "RNAdfactenSDK.h"

#import <react/renderer/components/RNAdfactenAdsSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNAdfactenAdsSpec/EventEmitters.h>
#import <react/renderer/components/RNAdfactenAdsSpec/Props.h>
#import <react/renderer/components/RNAdfactenAdsSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface RNAdfactenBannerView () <ADFBannerViewDelegate>
@end

@implementation RNAdfactenBannerView {
  ADFBannerView *_banner;
  NSString *_loadedKey;
  NSString *_placementId;
  NSString *_size;
  BOOL _autoRefresh;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<RNAdfactenBannerViewComponentDescriptor>();
}

// A banner owns timers and an impression; never hand it to another React view.
+ (BOOL)shouldBeRecycled
{
  return NO;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const RNAdfactenBannerViewProps>();
    _props = defaultProps;
    _placementId = @"";
    _size = @"banner";
    _autoRefresh = YES;
    self.clipsToBounds = YES;
  }
  return self;
}

- (void)dealloc
{
  [self destroyBanner];
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &p = *std::static_pointer_cast<RNAdfactenBannerViewProps const>(props);
  _placementId = [[NSString stringWithUTF8String:p.placementId.c_str()]
      stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  _size = [NSString stringWithUTF8String:p.size.c_str()];
  _autoRefresh = p.autoRefresh;
  [super updateProps:props oldProps:oldProps];
}

- (void)finalizeUpdates:(RNComponentViewUpdateMask)updateMask
{
  [super finalizeUpdates:updateMask];
  [self commit];
}

- (void)commit
{
  if (_placementId.length == 0) {
    [self destroyBanner];
    return;
  }
  NSString *key = [NSString stringWithFormat:@"%@|%@", _placementId, _size];
  if (_banner && [key isEqualToString:_loadedKey]) {
    _banner.refreshInterval = _autoRefresh ? 60 : 0;
    return;
  }
  [self destroyBanner];
  _loadedKey = key;
  ADFBannerView *banner = [[ADFBannerView alloc] initWithPlacementId:_placementId size:[self adSize]];
  banner.delegate = self;
  banner.refreshInterval = _autoRefresh ? 60 : 0;
  [self addSubview:banner];
  _banner = banner;
  [self setNeedsLayout];
  [banner load];
}

- (void)destroyBanner
{
  if (_banner == nil) return;
  _banner.delegate = nil;
  [_banner destroy];
  [_banner removeFromSuperview];
  _banner = nil;
  _loadedKey = nil;
}

- (ADFBannerSize)adSize
{
  if ([_size isEqualToString:@"largeBanner"]) return ADFBannerSizeLargeBanner;
  if ([_size isEqualToString:@"mediumRectangle"]) return ADFBannerSizeMediumRectangle;
  if ([_size isEqualToString:@"leaderboard"]) return ADFBannerSizeLeaderboard;
  return ADFBannerSizeBanner;
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  if (_banner == nil) return;
  CGSize size = _banner.intrinsicContentSize;
  CGRect bounds = self.bounds;
  _banner.frame = CGRectMake(
      floor((bounds.size.width - size.width) / 2), floor((bounds.size.height - size.height) / 2), size.width,
      size.height);
}

#pragma mark - ADFBannerViewDelegate

- (std::shared_ptr<const RNAdfactenBannerViewEventEmitter>)emitter
{
  return std::static_pointer_cast<const RNAdfactenBannerViewEventEmitter>(_eventEmitter);
}

- (void)bannerViewDidLoad:(ADFBannerView *)bannerView
{
  if (auto e = [self emitter]) e->onAdLoaded({});
}

- (void)bannerView:(ADFBannerView *)bannerView didFailWithError:(NSError *)error
{
  if (auto e = [self emitter]) {
    RNAdfactenBannerViewEventEmitter::OnAdFailedToLoad payload;
    payload.code = std::string([[RNAdfactenErrors codeForError:error] UTF8String]);
    payload.message = std::string([(error.localizedDescription ?: @"") UTF8String]);
    payload.serverCode = std::string([([RNAdfactenErrors serverCodeForError:error] ?: @"") UTF8String]);
    payload.nativeCode = (int)error.code;
    e->onAdFailedToLoad(payload);
  }
}

- (void)bannerViewDidRecordImpression:(ADFBannerView *)bannerView
{
  if (auto e = [self emitter]) e->onAdImpression({});
}

- (void)bannerViewDidClick:(ADFBannerView *)bannerView
{
  if (auto e = [self emitter]) e->onAdClicked({});
}

@end
