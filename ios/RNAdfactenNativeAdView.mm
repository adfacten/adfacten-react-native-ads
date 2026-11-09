#import "RNAdfactenNativeAdView.h"
#import "RNAdfactenSDK.h"

#import <React/RCTConversions.h>
#import <react/renderer/components/RNAdfactenAdsSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNAdfactenAdsSpec/EventEmitters.h>
#import <react/renderer/components/RNAdfactenAdsSpec/Props.h>
#import <react/renderer/components/RNAdfactenAdsSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

static UIColor *RNAdfColor(uint32_t rgb)
{
  return [UIColor colorWithRed:((rgb >> 16) & 0xFF) / 255.0
                         green:((rgb >> 8) & 0xFF) / 255.0
                          blue:(rgb & 0xFF) / 255.0
                         alpha:1];
}

static std::string RNAdfString(NSString *_Nullable s)
{
  return std::string([(s ?: @"") UTF8String]);
}

/** The "Ad" badge: a label with a little padding. */
@interface RNAdfactenBadgeLabel : UILabel
@end

@implementation RNAdfactenBadgeLabel
- (CGSize)intrinsicContentSize
{
  CGSize s = [super intrinsicContentSize];
  return CGSizeMake(s.width + 8, s.height + 2);
}

- (void)drawTextInRect:(CGRect)rect
{
  [super drawTextInRect:UIEdgeInsetsInsetRect(rect, UIEdgeInsetsMake(1, 4, 1, 4))];
}
@end

/** The pieces of a built template that styling touches. */
@interface RNAdfactenTemplateParts : NSObject
@property (nonatomic) BOOL small;
@property (nonatomic, strong) UILabel *title;
@property (nonatomic, strong) UILabel *body;
@property (nonatomic, strong) UILabel *brand;
@property (nonatomic, strong) UILabel *label;
@property (nonatomic, strong) UIButton *cta;
@property (nonatomic, strong, nullable) UIImageView *media;
@property (nonatomic, strong, nullable) UIImageView *icon;
@end

@implementation RNAdfactenTemplateParts
@end

@interface RNAdfactenNativeAdView () <ADFNativeAdDelegate>
@end

@implementation RNAdfactenNativeAdView {
  ADFNativeAd *_ad;
  ADFNativeAdView *_adView;
  RNAdfactenTemplateParts *_parts;
  NSString *_placementId;
  NSString *_loadedPlacement;
  NSString *_template;
  NSString *_builtTemplate;
  NSUInteger _loadToken;
  CGFloat _measuredWidth;
  CGFloat _reportedHeight;

  UIColor *_titleColor;
  UIColor *_bodyColor;
  UIColor *_secondaryColor;
  UIColor *_ctaColor;
  UIColor *_ctaTextColor;
  UIColor *_adLabelColor;
  CGFloat _titleFontSize;
  CGFloat _bodyFontSize;
  CGFloat _ctaCornerRadius;
  CGFloat _mediaCornerRadius;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<RNAdfactenNativeAdViewComponentDescriptor>();
}

+ (BOOL)shouldBeRecycled
{
  return NO;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const RNAdfactenNativeAdViewProps>();
    _props = defaultProps;
    _placementId = @"";
    _template = @"medium";
    _reportedHeight = -1;
    _ctaCornerRadius = -1;
    _mediaCornerRadius = -1;
    self.clipsToBounds = YES;
  }
  return self;
}

- (void)dealloc
{
  [self releaseAd];
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &p = *std::static_pointer_cast<RNAdfactenNativeAdViewProps const>(props);
  _placementId = [[NSString stringWithUTF8String:p.placementId.c_str()]
      stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  _template = p.templateType == "small" ? @"small" : @"medium";
  _titleColor = RCTUIColorFromSharedColor(p.titleColor);
  _bodyColor = RCTUIColorFromSharedColor(p.bodyColor);
  _secondaryColor = RCTUIColorFromSharedColor(p.secondaryColor);
  _ctaColor = RCTUIColorFromSharedColor(p.callToActionColor);
  _ctaTextColor = RCTUIColorFromSharedColor(p.callToActionTextColor);
  _adLabelColor = RCTUIColorFromSharedColor(p.adLabelColor);
  _titleFontSize = p.titleFontSize;
  _bodyFontSize = p.bodyFontSize;
  _ctaCornerRadius = p.callToActionCornerRadius;
  _mediaCornerRadius = p.mediaCornerRadius;
  [super updateProps:props oldProps:oldProps];
}

- (void)finalizeUpdates:(RNComponentViewUpdateMask)updateMask
{
  [super finalizeUpdates:updateMask];
  [self commit];
}

- (void)commit
{
  if (![_placementId isEqualToString:_loadedPlacement ?: @"\x01"]) {
    _loadedPlacement = _placementId;
    [self load];
    return;
  }
  if (_ad == nil) return;
  // Rebinding would start a new impression, so only a template switch rebuilds the view;
  // colors and sizes are applied in place.
  if (![_template isEqualToString:_builtTemplate]) {
    [self bind:_ad];
  } else if (_parts) {
    [self applyStyle:_parts];
    [self remeasure:YES];
  }
}

#pragma mark - Loading

- (void)load
{
  [self releaseAd];
  [self reportHeight:0];
  if (_placementId.length == 0) return;
  NSUInteger token = ++_loadToken;
  __weak RNAdfactenNativeAdView *weakSelf = self;
  [ADFNativeAd loadWithPlacementId:_placementId
                        completion:^(ADFNativeAd *ad, NSError *error) {
                          RNAdfactenNativeAdView *strongSelf = weakSelf;
                          if (strongSelf == nil || token != strongSelf->_loadToken) return;
                          if (ad) {
                            [strongSelf didLoad:ad];
                          } else {
                            [strongSelf didFail:error];
                          }
                        }];
}

- (void)didLoad:(ADFNativeAd *)ad
{
  _ad = ad;
  ad.delegate = self;
  [self bind:ad];
  if (auto e = [self emitter]) {
    RNAdfactenNativeAdViewEventEmitter::OnAdLoaded payload;
    payload.title = RNAdfString(ad.title);
    payload.body = RNAdfString(ad.body);
    payload.brand = RNAdfString(ad.brand);
    payload.callToAction = RNAdfString(ad.callToAction);
    payload.adLabel = RNAdfString(ad.adLabel);
    e->onAdLoaded(payload);
  }
}

- (void)didFail:(NSError *_Nullable)error
{
  NSError *err = error ?: [NSError errorWithDomain:@"com.adfacten.ads" code:0 userInfo:nil];
  if (auto e = [self emitter]) {
    RNAdfactenNativeAdViewEventEmitter::OnAdFailedToLoad payload;
    payload.code = RNAdfString([RNAdfactenErrors codeForError:err]);
    payload.message = RNAdfString(err.localizedDescription);
    payload.serverCode = RNAdfString([RNAdfactenErrors serverCodeForError:err]);
    payload.nativeCode = (int)err.code;
    e->onAdFailedToLoad(payload);
  }
}

- (void)releaseAd
{
  _loadToken++;
  _adView.nativeAd = nil;
  [_adView removeFromSuperview];
  _adView = nil;
  _parts = nil;
  _builtTemplate = nil;
  _ad.delegate = nil;
  _ad = nil;
}

#pragma mark - Template

- (void)bind:(ADFNativeAd *)ad
{
  if (_adView) {
    _adView.nativeAd = nil;
    [_adView removeFromSuperview];
  }
  ADFNativeAdView *view = [self buildTemplate:ad];
  view.frame = self.bounds;
  view.autoresizingMask = UIViewAutoresizingFlexibleWidth;
  [self addSubview:view];
  _adView = view;
  _builtTemplate = _template;
  view.nativeAd = ad;
  [self remeasure:YES];
}

- (UILabel *)labelWithLines:(NSInteger)lines
{
  UILabel *l = [UILabel new];
  l.numberOfLines = lines;
  l.lineBreakMode = NSLineBreakByTruncatingTail;
  l.translatesAutoresizingMaskIntoConstraints = NO;
  return l;
}

- (UIStackView *)stack:(NSArray<UIView *> *)views axis:(UILayoutConstraintAxis)axis spacing:(CGFloat)spacing
{
  UIStackView *s = [[UIStackView alloc] initWithArrangedSubviews:views];
  s.axis = axis;
  s.spacing = spacing;
  s.alignment = axis == UILayoutConstraintAxisHorizontal ? UIStackViewAlignmentCenter : UIStackViewAlignmentFill;
  s.translatesAutoresizingMaskIntoConstraints = NO;
  return s;
}

- (ADFNativeAdView *)buildTemplate:(ADFNativeAd *)ad
{
  BOOL small = [_template isEqualToString:@"small"];
  ADFNativeAdView *root = [[ADFNativeAdView alloc] initWithFrame:CGRectZero];

  RNAdfactenTemplateParts *p = [RNAdfactenTemplateParts new];
  p.small = small;
  p.title = [self labelWithLines:small ? 1 : 2];
  p.body = [self labelWithLines:small ? 2 : 3];
  p.brand = [self labelWithLines:1];
  [p.brand setContentCompressionResistancePriority:UILayoutPriorityDefaultLow forAxis:UILayoutConstraintAxisHorizontal];

  UILabel *badge = [RNAdfactenBadgeLabel new];
  badge.font = [UIFont boldSystemFontOfSize:10];
  badge.textColor = UIColor.blackColor;
  badge.layer.cornerRadius = 3;
  badge.layer.masksToBounds = YES;
  badge.textAlignment = NSTextAlignmentCenter;
  [badge setContentHuggingPriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisHorizontal];
  [badge setContentCompressionResistancePriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisHorizontal];
  badge.translatesAutoresizingMaskIntoConstraints = NO;
  p.label = badge;

  UIButton *cta = [UIButton buttonWithType:UIButtonTypeCustom];
  cta.titleLabel.font = [UIFont boldSystemFontOfSize:14];
  cta.titleLabel.lineBreakMode = NSLineBreakByTruncatingTail;
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
  cta.contentEdgeInsets = UIEdgeInsetsMake(0, 14, 0, 14);
#pragma clang diagnostic pop
  cta.translatesAutoresizingMaskIntoConstraints = NO;
  [cta setContentHuggingPriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisHorizontal];
  [cta setContentCompressionResistancePriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisHorizontal];
  p.cta = cta;

  UIImageView *icon = nil;
  if (ad.icon) {
    icon = [UIImageView new];
    icon.contentMode = UIViewContentModeScaleAspectFill;
    icon.clipsToBounds = YES;
    icon.layer.cornerRadius = 6;
    icon.translatesAutoresizingMaskIntoConstraints = NO;
    p.icon = icon;
  }

  UIStackView *labelRow = [self stack:@[ badge, p.brand ] axis:UILayoutConstraintAxisHorizontal spacing:6];
  UIStackView *content;
  NSMutableArray<NSLayoutConstraint *> *constraints = [NSMutableArray array];

  if (small) {
    UIStackView *texts = [self stack:@[ labelRow, p.title, p.body ] axis:UILayoutConstraintAxisVertical spacing:3];
    texts.alignment = UIStackViewAlignmentLeading;
    NSMutableArray *row = [NSMutableArray array];
    if (icon) {
      [row addObject:icon];
      [constraints addObjectsFromArray:@[
        [icon.widthAnchor constraintEqualToConstant:56], [icon.heightAnchor constraintEqualToConstant:56]
      ]];
    }
    [row addObjectsFromArray:@[ texts, cta ]];
    content = [self stack:row axis:UILayoutConstraintAxisHorizontal spacing:12];
    [constraints addObject:[cta.heightAnchor constraintGreaterThanOrEqualToConstant:36]];
  } else {
    UIStackView *headTexts = [self stack:@[ p.title, labelRow ] axis:UILayoutConstraintAxisVertical spacing:4];
    headTexts.alignment = UIStackViewAlignmentLeading;
    NSMutableArray *head = [NSMutableArray array];
    if (icon) {
      [head addObject:icon];
      [constraints addObjectsFromArray:@[
        [icon.widthAnchor constraintEqualToConstant:40], [icon.heightAnchor constraintEqualToConstant:40]
      ]];
    }
    [head addObject:headTexts];
    UIStackView *header = [self stack:head axis:UILayoutConstraintAxisHorizontal spacing:10];
    NSMutableArray *rows = [NSMutableArray arrayWithObjects:header, p.body, nil];
    if (ad.image) {
      UIImageView *media = [UIImageView new];
      media.contentMode = UIViewContentModeScaleAspectFill;
      media.clipsToBounds = YES;
      media.backgroundColor = [UIColor colorWithWhite:0 alpha:0.07];
      media.translatesAutoresizingMaskIntoConstraints = NO;
      CGFloat ratio = [self mediaRatio:ad];
      NSLayoutConstraint *aspect = [media.heightAnchor constraintEqualToAnchor:media.widthAnchor multiplier:1.0 / ratio];
      aspect.priority = UILayoutPriorityRequired - 1;
      [constraints addObject:aspect];
      [rows addObject:media];
      p.media = media;
    }
    [rows addObject:cta];
    content = [self stack:rows axis:UILayoutConstraintAxisVertical spacing:10];
    [content setCustomSpacing:8 afterView:header];
    [constraints addObject:[cta.heightAnchor constraintEqualToConstant:44]];
  }

  [root addSubview:content];
  [constraints addObjectsFromArray:@[
    [content.leadingAnchor constraintEqualToAnchor:root.leadingAnchor constant:12],
    [content.trailingAnchor constraintEqualToAnchor:root.trailingAnchor constant:-12],
    [content.topAnchor constraintEqualToAnchor:root.topAnchor constant:12],
  ]];
  NSLayoutConstraint *bottom = [content.bottomAnchor constraintEqualToAnchor:root.bottomAnchor constant:-12];
  // The React height can lag behind the measured one; let the bottom give way instead of the content.
  bottom.priority = UILayoutPriorityDefaultHigh;
  [constraints addObject:bottom];
  [NSLayoutConstraint activateConstraints:constraints];

  root.titleLabel = p.title;
  root.bodyLabel = p.body;
  root.brandLabel = p.brand;
  root.adLabel = badge;
  root.callToActionButton = cta;
  root.mediaView = p.media;
  root.iconView = icon;

  _parts = p;
  [self applyStyle:p];
  return root;
}

- (CGFloat)mediaRatio:(ADFNativeAd *)ad
{
  CGSize s = ad.imageSize;
  if (s.width <= 0 || s.height <= 0) s = ad.image.size;
  CGFloat r = (s.width > 0 && s.height > 0) ? s.width / s.height : 1.91;
  return MIN(MAX(r, 0.75), 3.0);
}

- (void)applyStyle:(RNAdfactenTemplateParts *)p
{
  CGFloat titleSize = _titleFontSize > 0 ? _titleFontSize : (p.small ? 15 : 16);
  CGFloat bodySize = _bodyFontSize > 0 ? _bodyFontSize : 13;
  p.title.font = [UIFont boldSystemFontOfSize:titleSize];
  p.title.textColor = _titleColor ?: RNAdfColor(0x1F1F1F);
  p.body.font = [UIFont systemFontOfSize:bodySize];
  p.body.textColor = _bodyColor ?: RNAdfColor(0x5F6368);
  p.brand.font = [UIFont systemFontOfSize:12];
  p.brand.textColor = _secondaryColor ?: RNAdfColor(0x80868B);
  p.label.backgroundColor = _adLabelColor ?: RNAdfColor(0xFBC02D);
  p.cta.backgroundColor = _ctaColor ?: RNAdfColor(0x1A73E8);
  [p.cta setTitleColor:_ctaTextColor ?: UIColor.whiteColor forState:UIControlStateNormal];
  p.cta.layer.cornerRadius = _ctaCornerRadius >= 0 ? _ctaCornerRadius : 6;
  p.cta.clipsToBounds = YES;
  p.media.layer.cornerRadius = _mediaCornerRadius >= 0 ? _mediaCornerRadius : 6;
}

#pragma mark - Layout

- (void)layoutSubviews
{
  [super layoutSubviews];
  if (_adView == nil) return;
  _adView.frame = CGRectMake(0, 0, self.bounds.size.width, MAX(self.bounds.size.height, _adView.frame.size.height));
  if (self.bounds.size.width != _measuredWidth) {
    [self remeasure:NO];
  }
}

/** Measures the template at the current width and tells JS the height it needs. */
- (void)remeasure:(BOOL)force
{
  CGFloat width = self.bounds.size.width;
  if (_adView == nil || width <= 0) return;
  if (!force && width == _measuredWidth) return;
  _measuredWidth = width;
  CGSize fit = [_adView systemLayoutSizeFittingSize:CGSizeMake(width, UILayoutFittingCompressedSize.height)
                      withHorizontalFittingPriority:UILayoutPriorityRequired
                            verticalFittingPriority:UILayoutPriorityFittingSizeLevel];
  CGFloat height = ceil(fit.height);
  _adView.frame = CGRectMake(0, 0, width, MAX(height, self.bounds.size.height));
  [self reportHeight:height];
}

- (void)reportHeight:(CGFloat)height
{
  if (height == _reportedHeight) return;
  _reportedHeight = height;
  if (auto e = [self emitter]) {
    e->onAdLayout({.height = height});
  }
}

#pragma mark - Events

- (std::shared_ptr<const RNAdfactenNativeAdViewEventEmitter>)emitter
{
  return std::static_pointer_cast<const RNAdfactenNativeAdViewEventEmitter>(_eventEmitter);
}

- (void)nativeAdDidRecordImpression:(ADFNativeAd *)nativeAd
{
  if (auto e = [self emitter]) e->onAdImpression({});
}

- (void)nativeAdDidClick:(ADFNativeAd *)nativeAd
{
  if (auto e = [self emitter]) e->onAdClicked({});
}

@end
