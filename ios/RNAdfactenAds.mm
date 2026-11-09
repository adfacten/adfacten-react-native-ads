#import "RNAdfactenAds.h"
#import "RNAdfactenSDK.h"

#import <React/RCTUtils.h>

@interface RNAdfactenAds () <ADFFullScreenAdDelegate>
@end

@implementation RNAdfactenAds {
  // Loaded ads by JS id. Touched on the main queue only.
  NSMutableDictionary<NSString *, ADFFullScreenAd *> *_ads;
  NSMapTable<ADFFullScreenAd *, NSString *> *_ids;
}

- (instancetype)init
{
  if (self = [super init]) {
    _ads = [NSMutableDictionary new];
    _ids = [NSMapTable weakToStrongObjectsMapTable];
  }
  return self;
}

+ (NSString *)moduleName
{
  return @"RNAdfactenAds";
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

// The SDK is main-actor bound; every method runs on the main queue.
- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeAdfactenAdsSpecJSI>(params);
}

- (void)invalidate
{
  RCTExecuteOnMainQueue(^{
    for (ADFFullScreenAd *ad in self->_ads.allValues) {
      ad.delegate = nil;
    }
    [self->_ads removeAllObjects];
  });
}

#pragma mark - SDK

- (void)initialize:(NSString *)appKey config:(JS::NativeAdfactenAds::NativeConfig &)config
{
  ADFConfig *c = [ADFConfig new];
  c.testMode = config.testMode().value_or(false);
  c.childDirected = config.childDirected().value_or(false);
  c.logLevel = [RNAdfactenAds logLevelFrom:config.logLevel()];
  NSString *userId = config.userId();
  if (userId.length > 0) {
    c.userId = userId;
  }
  NSString *pluginVersion = config.pluginVersion();
  [ADFAdfacten setWrapperName:@"react_native" version:pluginVersion.length > 0 ? pluginVersion : @"unknown"];
  [ADFAdfacten initializeWithAppKey:appKey config:c];
}

- (void)setUserId:(NSString *_Nullable)userId
{
  [ADFAdfacten setUserId:userId.length > 0 ? userId : nil];
}

- (void)getSdkVersion:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(ADFAdfacten.sdkVersion);
}

+ (ADFLogLevel)logLevelFrom:(NSString *_Nullable)value
{
  if ([value isEqualToString:@"none"]) return ADFLogLevelNone;
  if ([value isEqualToString:@"error"]) return ADFLogLevelError;
  if ([value isEqualToString:@"info"]) return ADFLogLevelInfo;
  if ([value isEqualToString:@"debug"]) return ADFLogLevelDebug;
  return ADFLogLevelWarning;
}

#pragma mark - Full-screen ads

- (void)loadFullScreenAd:(NSString *)format
                    adId:(NSString *)adId
             placementId:(NSString *)placementId
                 options:(JS::NativeAdfactenAds::NativeLoadOptions &)options
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  __weak RNAdfactenAds *weakSelf = self;
  void (^done)(ADFFullScreenAd *_Nullable, NSError *_Nullable) = ^(ADFFullScreenAd *ad, NSError *error) {
    RNAdfactenAds *strongSelf = weakSelf;
    if (ad == nil) {
      NSError *e = error ?: [NSError errorWithDomain:@"com.adfacten.ads" code:0 userInfo:nil];
      reject([RNAdfactenErrors codeForError:e], e.localizedDescription, [RNAdfactenErrors bridgeError:e]);
      return;
    }
    if (strongSelf == nil) {
      reject(@"internal_error", @"the module was released", nil);
      return;
    }
    ad.delegate = strongSelf;
    strongSelf->_ads[adId] = ad;
    [strongSelf->_ids setObject:adId forKey:ad];
    NSMutableDictionary *result = [NSMutableDictionary dictionary];
    if ([ad isKindOfClass:[ADFRewardedAd class]]) {
      ADFReward *reward = ((ADFRewardedAd *)ad).reward;
      if (reward) {
        result[@"rewardType"] = reward.type;
        result[@"rewardAmount"] = @(reward.amount);
      }
    }
    resolve(result);
  };

  if ([format isEqualToString:@"interstitial"]) {
    [ADFInterstitialAd loadWithPlacementId:placementId
                                completion:^(ADFInterstitialAd *ad, NSError *error) { done(ad, error); }];
  } else if ([format isEqualToString:@"app_open"]) {
    [ADFAppOpenAd loadWithPlacementId:placementId
                           completion:^(ADFAppOpenAd *ad, NSError *error) { done(ad, error); }];
  } else if ([format isEqualToString:@"rewarded"]) {
    NSString *custom = options.customData();
    [ADFRewardedAd loadWithPlacementId:placementId
                            customData:custom.length > 0 ? custom : nil
                            completion:^(ADFRewardedAd *ad, NSError *error) { done(ad, error); }];
  } else {
    reject(@"invalid_request", [NSString stringWithFormat:@"unknown ad format \"%@\"", format], nil);
  }
}

- (void)showFullScreenAd:(NSString *)adId
{
  ADFFullScreenAd *ad = _ads[adId];
  if (ad == nil) {
    [self emit:adId type:@"failedToShow" extra:@{
      @"errorCode" : @"not_ready",
      @"errorMessage" : @"the ad is not loaded or was already shown",
    }];
    return;
  }
  UIViewController *presenter = RCTPresentedViewController();
  if (presenter == nil) {
    [self emit:adId type:@"failedToShow" extra:@{
      @"errorCode" : @"show_failed",
      @"errorMessage" : @"no view controller to present from",
    }];
    return;
  }
  if ([ad isKindOfClass:[ADFRewardedAd class]]) {
    __weak RNAdfactenAds *weakSelf = self;
    [(ADFRewardedAd *)ad presentFromViewController:presenter
                          userDidEarnRewardHandler:^(ADFReward *reward) {
                            [weakSelf emit:adId type:@"userEarnedReward" extra:@{
                              @"rewardType" : reward.type ?: @"",
                              @"rewardAmount" : @(reward.amount),
                            }];
                          }];
  } else {
    [ad presentFromViewController:presenter];
  }
}

- (void)destroyFullScreenAd:(NSString *)adId
{
  ADFFullScreenAd *ad = _ads[adId];
  ad.delegate = nil;
  [_ads removeObjectForKey:adId];
}

#pragma mark - ADFFullScreenAdDelegate

- (void)adDidPresent:(ADFFullScreenAd *)ad
{
  [self emitFor:ad type:@"shown" extra:nil];
}

- (void)adDidClick:(ADFFullScreenAd *)ad
{
  [self emitFor:ad type:@"clicked" extra:nil];
}

- (void)adDidDismiss:(ADFFullScreenAd *)ad
{
  NSString *adId = [_ids objectForKey:ad];
  [self emitFor:ad type:@"closed" extra:nil];
  if (adId) {
    ad.delegate = nil;
    [_ads removeObjectForKey:adId];
  }
}

- (void)ad:(ADFFullScreenAd *)ad didFailToPresentWithError:(NSError *)error
{
  NSMutableDictionary *extra = [NSMutableDictionary dictionary];
  extra[@"errorCode"] = [RNAdfactenErrors codeForError:error];
  extra[@"errorMessage"] = error.localizedDescription ?: @"";
  extra[@"nativeCode"] = @(error.code);
  NSString *serverCode = [RNAdfactenErrors serverCodeForError:error];
  if (serverCode) extra[@"serverCode"] = serverCode;
  [self emitFor:ad type:@"failedToShow" extra:extra];
}

#pragma mark - Events

- (void)emitFor:(ADFFullScreenAd *)ad type:(NSString *)type extra:(NSDictionary *_Nullable)extra
{
  NSString *adId = [_ids objectForKey:ad];
  if (adId) {
    [self emit:adId type:type extra:extra];
  }
}

- (void)emit:(NSString *)adId type:(NSString *)type extra:(NSDictionary *_Nullable)extra
{
  NSMutableDictionary *event = [NSMutableDictionary dictionaryWithDictionary:extra ?: @{}];
  event[@"adId"] = adId;
  event[@"type"] = type;
  [self emitOnAdEvent:event];
}

@end
