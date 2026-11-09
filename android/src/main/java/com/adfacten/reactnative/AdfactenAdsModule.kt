package com.adfacten.reactnative

import com.adfacten.ads.AdError
import com.adfacten.ads.AdLoadCallback
import com.adfacten.ads.Adfacten
import com.adfacten.ads.AdfactenConfig
import com.adfacten.ads.AppOpenAd
import com.adfacten.ads.FullScreenAd
import com.adfacten.ads.FullScreenAdListener
import com.adfacten.ads.InterstitialAd
import com.adfacten.ads.LogLevel
import com.adfacten.ads.OnUserEarnedRewardListener
import com.adfacten.ads.RewardedAd
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = AdfactenAdsModule.NAME)
class AdfactenAdsModule(reactContext: ReactApplicationContext) :
  NativeAdfactenAdsSpec(reactContext) {

  // Touched on the main thread only.
  private val ads = HashMap<String, FullScreenAd>()

  override fun getName(): String = NAME

  override fun initialize(appKey: String, config: ReadableMap) {
    val testMode = config.optBoolean("testMode")
    val childDirected = config.optBoolean("childDirected")
    val logLevel = logLevelOf(config.optString("logLevel"))
    val userId = config.optString("userId")
    val pluginVersion = config.optString("pluginVersion") ?: "unknown"
    UiThreadUtil.runOnUiThread {
      Adfacten.setWrapper("react_native", pluginVersion)
      Adfacten.initialize(
        reactApplicationContext.applicationContext,
        appKey,
        AdfactenConfig(
          testMode = testMode,
          logLevel = logLevel,
          childDirected = childDirected,
          userId = userId,
        ),
      )
    }
  }

  override fun setUserId(userId: String?) {
    UiThreadUtil.runOnUiThread { Adfacten.setUserId(userId) }
  }

  override fun getSdkVersion(promise: Promise) {
    promise.resolve(Adfacten.sdkVersion)
  }

  override fun loadFullScreenAd(
    format: String,
    adId: String,
    placementId: String,
    options: ReadableMap,
    promise: Promise,
  ) {
    val customData = options.optString("customData")
    UiThreadUtil.runOnUiThread {
      val context = reactApplicationContext
      when (format) {
        "interstitial" -> InterstitialAd.load(context, placementId, callback(adId, promise))
        "app_open" -> AppOpenAd.load(context, placementId, callback(adId, promise))
        "rewarded" -> RewardedAd.load(context, placementId, callback(adId, promise), customData)
        else -> promise.reject("invalid_request", "unknown ad format \"$format\"")
      }
    }
  }

  private fun <T : FullScreenAd> callback(adId: String, promise: Promise) = object : AdLoadCallback<T> {
    override fun onLoaded(ad: T) {
      ad.listener = listenerFor(adId)
      ads[adId] = ad
      val result = Arguments.createMap()
      (ad as? RewardedAd)?.reward?.let {
        result.putString("rewardType", it.type)
        result.putDouble("rewardAmount", it.amount.toDouble())
      }
      promise.resolve(result)
    }

    override fun onFailed(error: AdError) {
      AdErrors.reject(promise, error)
    }
  }

  private fun listenerFor(adId: String) = object : FullScreenAdListener {
    override fun onShown() = emit(adId, "shown")
    override fun onClicked() = emit(adId, "clicked")
    override fun onClosed() {
      ads.remove(adId)
      emit(adId, "closed")
    }
    override fun onFailedToShow(error: AdError) {
      emit(adId, "failedToShow") { AdErrors.putEventFields(it, error) }
    }
  }

  override fun showFullScreenAd(adId: String) {
    UiThreadUtil.runOnUiThread {
      val ad = ads[adId]
      if (ad == null) {
        emitShowFailure(adId, "not_ready", "the ad is not loaded or was already shown")
        return@runOnUiThread
      }
      val activity = reactApplicationContext.currentActivity
      if (activity == null || activity.isFinishing) {
        emitShowFailure(adId, "show_failed", "no activity in the foreground")
        return@runOnUiThread
      }
      when (ad) {
        is InterstitialAd -> ad.show(activity)
        is AppOpenAd -> ad.show(activity)
        is RewardedAd -> ad.show(activity, OnUserEarnedRewardListener { reward ->
          emit(adId, "userEarnedReward") {
            it.putString("rewardType", reward.type)
            it.putDouble("rewardAmount", reward.amount.toDouble())
          }
        })
      }
    }
  }

  override fun destroyFullScreenAd(adId: String) {
    UiThreadUtil.runOnUiThread {
      ads.remove(adId)?.listener = null
    }
  }

  override fun invalidate() {
    UiThreadUtil.runOnUiThread {
      ads.values.forEach { it.listener = null }
      ads.clear()
    }
    super.invalidate()
  }

  private fun emitShowFailure(adId: String, code: String, message: String) {
    emit(adId, "failedToShow") {
      it.putString("errorCode", code)
      it.putString("errorMessage", message)
    }
  }

  private fun emit(adId: String, type: String, fill: ((WritableMap) -> Unit)? = null) {
    val event = Arguments.createMap()
    event.putString("adId", adId)
    event.putString("type", type)
    fill?.invoke(event)
    emitOnAdEvent(event)
  }

  private fun logLevelOf(value: String?): LogLevel = when (value) {
    "none" -> LogLevel.NONE
    "error" -> LogLevel.ERROR
    "info" -> LogLevel.INFO
    "debug" -> LogLevel.DEBUG
    else -> LogLevel.WARN
  }

  companion object {
    const val NAME = NativeAdfactenAdsSpec.NAME
  }
}

internal fun ReadableMap.optBoolean(key: String): Boolean =
  hasKey(key) && !isNull(key) && getBoolean(key)

internal fun ReadableMap.optString(key: String): String? =
  if (hasKey(key) && !isNull(key)) getString(key)?.takeIf { it.isNotEmpty() } else null
