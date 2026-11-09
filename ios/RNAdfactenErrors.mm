#import "RNAdfactenSDK.h"

@implementation RNAdfactenErrors

+ (NSString *)codeForError:(NSError *)error
{
  if (![error.domain isEqualToString:@"com.adfacten.ads"]) {
    return @"INTERNAL_ERROR";
  }
  switch ((ADFErrorCode)error.code) {
    case ADFErrorCodeNotInitialized: return @"NOT_INITIALIZED";
    case ADFErrorCodeNoFill: return @"NO_FILL";
    case ADFErrorCodeNetwork: return @"NETWORK_ERROR";
    case ADFErrorCodeServerRejected: return @"REJECTED";
    case ADFErrorCodeInvalidResponse: return @"INVALID_RESPONSE";
    case ADFErrorCodeExpired: return @"AD_EXPIRED";
    case ADFErrorCodeNotReady: return @"NOT_READY";
    case ADFErrorCodePresentationFailed: return @"SHOW_FAILED";
    case ADFErrorCodeCreativeFailed: return @"CREATIVE_FAILED";
    case ADFErrorCodeChildDirected: return @"CHILD_DIRECTED";
  }
  return @"INTERNAL_ERROR";
}

+ (nullable NSString *)serverCodeForError:(NSError *)error
{
  id value = error.userInfo[@"serverCode"];
  return [value isKindOfClass:[NSString class]] && [value length] > 0 ? value : nil;
}

+ (NSError *)bridgeError:(NSError *)error
{
  NSMutableDictionary *info = [NSMutableDictionary dictionary];
  info[NSLocalizedDescriptionKey] = error.localizedDescription ?: @"unknown error";
  info[@"nativeCode"] = @(error.code);
  NSString *serverCode = [self serverCodeForError:error];
  if (serverCode) {
    info[@"serverCode"] = serverCode;
  }
  return [NSError errorWithDomain:error.domain code:error.code userInfo:info];
}

@end
