// The Adfacten iOS SDK is a Swift framework with an Objective-C interface (ADF* names).
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

#if __has_include(<AdfactenAds/AdfactenAds-Swift.h>)
#import <AdfactenAds/AdfactenAds-Swift.h>
#else
#import "AdfactenAds-Swift.h"
#endif

NS_ASSUME_NONNULL_BEGIN

/** Error helpers shared by the module and the views. */
@interface RNAdfactenErrors : NSObject
/** The SDK's stable error name (no_fill, rejected, ...), passed to JS as the error code. */
+ (NSString *)codeForError:(NSError *)error;
+ (nullable NSString *)serverCodeForError:(NSError *)error;
/** An NSError whose userInfo carries serverCode and nativeCode for promise rejections. */
+ (NSError *)bridgeError:(NSError *)error;
@end

NS_ASSUME_NONNULL_END
