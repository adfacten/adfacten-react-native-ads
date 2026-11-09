package com.adfacten.reactnative

import com.adfacten.ads.AdError
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap

/**
 * Passes Android SDK errors to JS. The code is the SDK's stable error name (`no_fill`,
 * `rejected`, ...), shared with iOS; JS turns it into an `AdfactenErrorCode`.
 */
internal object AdErrors {
  fun reject(promise: Promise, error: AdError) {
    val info = Arguments.createMap()
    info.putInt("nativeCode", error.code)
    error.serverCode?.let { info.putString("serverCode", it) }
    promise.reject(error.name, error.message, info)
  }

  /** Fields of a full-screen `failedToShow` event. */
  fun putEventFields(map: WritableMap, error: AdError) {
    map.putString("errorCode", error.name)
    map.putString("errorMessage", error.message)
    map.putInt("nativeCode", error.code)
    error.serverCode?.let { map.putString("serverCode", it) }
  }

  /** Payload of a view's `onAdFailedToLoad` event. */
  fun viewEvent(error: AdError): WritableMap = Arguments.createMap().apply {
    putString("code", error.name)
    putString("message", error.message)
    putString("serverCode", error.serverCode ?: "")
    putInt("nativeCode", error.code)
  }
}
