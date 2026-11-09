#import "RNAdfactenSDK.h"

@implementation RNAdfactenErrors

+ (NSString *)codeForError:(NSError *)error
{
  if (![error.domain isEqualToString:@"com.adfacten.ads"]) {
    return @"internal_error";
  }
  id name = error.userInfo[ADFAdfacten.errorNameKey];
  return [name isKindOfClass:[NSString class]] && [name length] > 0 ? name : @"internal_error";
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
