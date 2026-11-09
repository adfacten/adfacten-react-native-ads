package com.adfacten.reactnative

import android.content.Context
import android.view.Gravity
import android.widget.FrameLayout
import com.adfacten.ads.AdError
import com.adfacten.ads.AdSize
import com.adfacten.ads.AdfactenBannerView
import com.adfacten.ads.BannerAdListener

/**
 * Hosts an [AdfactenBannerView]. Props are collected and applied in [commit], after each
 * transaction, so a placement or size change creates a fresh banner exactly once.
 */
class RNAdfactenBannerView(context: Context) : FrameLayout(context) {
  var placementId: String = ""
  var size: String = "banner"
  var autoRefresh: Boolean = true

  private var banner: AdfactenBannerView? = null
  private var loadedKey: String? = null
  // Whether refresh was set on the current banner. Until then the placement's setting applies.
  private var refreshSet = false

  fun commit() {
    val key = "$placementId|$size"
    if (placementId.isBlank()) {
      destroyBanner()
      return
    }
    banner?.let { applyRefresh(it) }
    if (key == loadedKey) return
    destroyBanner()
    loadedKey = key
    val view = AdfactenBannerView(context).also {
      it.placementId = placementId
      it.adSize = adSizeOf(size)
      applyRefresh(it)
      it.listener = object : BannerAdListener {
        override fun onLoaded() = dispatchAdEvent("topAdLoaded")
        override fun onFailed(error: AdError) = dispatchAdEvent("topAdFailedToLoad", AdErrors.viewEvent(error))
        override fun onShown() = dispatchAdEvent("topAdImpression")
        override fun onClicked() = dispatchAdEvent("topAdClicked")
      }
    }
    addView(view, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER))
    banner = view
    view.load()
  }

  fun destroyBanner() {
    banner?.let {
      it.listener = null
      it.destroy()
      removeView(it)
    }
    banner = null
    loadedKey = null
    refreshSet = false
  }

  /** autoRefresh=false turns refresh off. Left on, the placement's interval applies. */
  private fun applyRefresh(view: AdfactenBannerView) {
    if (!autoRefresh || refreshSet) {
      view.autoRefresh = autoRefresh
      refreshSet = true
    }
  }

  // React Native lays out its own views only; views added natively (the banner and its
  // creative) need an explicit measure and layout pass.
  private val measureAndLayout = Runnable {
    measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
    layout(left, top, right, bottom)
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  private fun adSizeOf(value: String): AdSize = when (value) {
    "largeBanner" -> AdSize.LARGE_BANNER
    "mediumRectangle" -> AdSize.MEDIUM_RECTANGLE
    "leaderboard" -> AdSize.LEADERBOARD
    else -> AdSize.BANNER
  }
}
