require "json"
require "digest"
require "fileutils"
require "open-uri"
require "tmpdir"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# Version of the native Adfacten iOS SDK this package is built against.
adfacten_ios_version = "1.0.0"
adfacten_ios_sha256 = "6ab9883dc8d92597f2f0c7391c4b2434c15950548e7e465e16367539290b883f"
adfacten_ios_url = "https://cdn.adfacten.com/ios/AdfactenAds-#{adfacten_ios_version}.xcframework.zip"

# How the native SDK is linked:
#   (default)                   download the prebuilt XCFramework from the Adfacten CDN, check its
#                               SHA-256 and vendor it in this pod. No Podfile changes needed.
#   ADFACTEN_IOS_SDK=pod        depend on the AdfactenAds pod instead. Add it to your Podfile:
#                               pod 'AdfactenAds', :git => 'https://github.com/adfacten/adfacten-ios-sdk.git', :tag => '1.0.0'
#   ADFACTEN_IOS_FRAMEWORK=path use an XCFramework you downloaded yourself (offline builds).
use_pod = ENV["ADFACTEN_IOS_SDK"] == "pod"

adfacten_vendor_framework = lambda do |dir, version, url, sha256|
  target = File.join(dir, "ios", "Frameworks")
  framework = File.join(target, "AdfactenAds.xcframework")
  stamp = File.join(target, ".version")
  next if File.directory?(framework) && File.exist?(stamp) && File.read(stamp).strip == version

  custom = ENV["ADFACTEN_IOS_FRAMEWORK"]
  FileUtils.rm_rf(framework)
  FileUtils.mkdir_p(target)
  if custom && !custom.empty?
    raise "[Adfacten] ADFACTEN_IOS_FRAMEWORK=#{custom} is not an XCFramework" unless File.directory?(custom)
    FileUtils.cp_r(custom, framework)
  else
    Pod::UI.puts "[Adfacten] Downloading AdfactenAds #{version} from #{url}"
    Dir.mktmpdir do |tmp|
      zip = File.join(tmp, "AdfactenAds.zip")
      URI.open(url, "rb", read_timeout: 120) { |remote| File.binwrite(zip, remote.read) }
      actual = Digest::SHA256.file(zip).hexdigest
      if actual != sha256
        raise "[Adfacten] Checksum mismatch for #{url}: expected #{sha256}, got #{actual}"
      end
      unless system("/usr/bin/ditto", "-x", "-k", zip, tmp)
        raise "[Adfacten] Could not unzip #{zip}"
      end
      found = Dir.glob(File.join(tmp, "**", "AdfactenAds.xcframework")).first
      raise "[Adfacten] AdfactenAds.xcframework not found in #{url}" unless found
      FileUtils.mv(found, framework)
    end
  end
  File.write(stamp, version)
end

adfacten_vendor_framework.call(__dir__, adfacten_ios_version, adfacten_ios_url, adfacten_ios_sha256) unless use_pod

Pod::Spec.new do |s|
  s.name         = "AdfactenReactNativeAds"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/adfacten/adfacten-react-native-ads.git", :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm}"
  s.private_header_files = "ios/**/*.h"

  if use_pod
    s.dependency "AdfactenAds", adfacten_ios_version
  else
    s.vendored_frameworks = "ios/Frameworks/AdfactenAds.xcframework"
  end
  s.frameworks = "UIKit", "WebKit", "AVFoundation", "StoreKit", "AdSupport", "AppTrackingTransparency", "Network", "SwiftUI"

  install_modules_dependencies(s)
end
