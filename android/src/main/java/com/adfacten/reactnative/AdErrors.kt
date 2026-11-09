package com.adfacten.reactnative

import com.adfacten.ads.AdError
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap

/** Maps Android SDK errors to the codes used by the JS API. */
internal object AdErrors {
  fun codeOf(error: AdError): String = when (error.code) {
    AdError.NOT_INITIALIZED -> "NOT_INITIALIZED"
    AdError.INVALID_REQUEST -> "INVALID_REQUEST"
    AdError.NETWORK_ERROR -> "NETWORK_ERROR"
    AdError.NO_FILL -> "NO_FILL"
    AdError.SERVER_ERROR -> "SERVER_ERROR"
    AdError.INVALID_RESPONSE -> "INVALID_RESPONSE"
    AdError.REJECTED -> "REJECTED"
    AdError.AD_EXPIRED -> "AD_EXPIRED"
    AdError.ALREADY_SHOWN -> "NOT_READY"
    AdError.VIDEO_NOT_SUPPORTED -> "VIDEO_NOT_SUPPORTED"
    AdError.SHOW_FAILED -> "SHOW_FAILED"
    AdError.LOAD_IN_PROGRESS -> "LOAD_IN_PROGRESS"
    else -> "INTERNAL_ERROR"
  }

  fun reject(promise: Promise, error: AdError) {
    val info = Arguments.createMap()
    info.putInt("nativeCode", error.code)
    error.serverCode?.let { info.putString("serverCode", it) }
    promise.reject(codeOf(error), error.message, info)
  }

  /** Fields of a full-screen `failedToShow` event. */
  fun putEventFields(map: WritableMap, error: AdError) {
    map.putString("errorCode", codeOf(error))
    map.putString("errorMessage", error.message)
    map.putInt("nativeCode", error.code)
    error.serverCode?.let { map.putString("serverCode", it) }
  }

  /** Payload of a view's `onAdFailedToLoad` event. */
  fun viewEvent(error: AdError): WritableMap = Arguments.createMap().apply {
    putString("code", codeOf(error))
    putString("message", error.message)
    putString("serverCode", error.serverCode ?: "")
    putInt("nativeCode", error.code)
  }
}
