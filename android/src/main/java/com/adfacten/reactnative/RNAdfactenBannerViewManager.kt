package com.adfacten.reactnative

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.RNAdfactenBannerViewManagerDelegate
import com.facebook.react.viewmanagers.RNAdfactenBannerViewManagerInterface

@ReactModule(name = RNAdfactenBannerViewManager.NAME)
class RNAdfactenBannerViewManager :
  SimpleViewManager<RNAdfactenBannerView>(),
  RNAdfactenBannerViewManagerInterface<RNAdfactenBannerView> {

  private val delegate = RNAdfactenBannerViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<RNAdfactenBannerView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext) = RNAdfactenBannerView(context)

  @ReactProp(name = "placementId")
  override fun setPlacementId(view: RNAdfactenBannerView, value: String?) {
    view.placementId = value?.trim().orEmpty()
  }

  @ReactProp(name = "size")
  override fun setSize(view: RNAdfactenBannerView, value: String?) {
    view.size = value ?: "banner"
  }

  @ReactProp(name = "autoRefresh", defaultBoolean = true)
  override fun setAutoRefresh(view: RNAdfactenBannerView, value: Boolean) {
    view.autoRefresh = value
  }

  override fun onAfterUpdateTransaction(view: RNAdfactenBannerView) {
    super.onAfterUpdateTransaction(view)
    view.commit()
  }

  override fun onDropViewInstance(view: RNAdfactenBannerView) {
    view.destroyBanner()
    super.onDropViewInstance(view)
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    AdViewEvent.exportedTypes(AdViewEvent.NAMES - "topAdLayout")

  companion object {
    const val NAME = "RNAdfactenBannerView"
  }
}
