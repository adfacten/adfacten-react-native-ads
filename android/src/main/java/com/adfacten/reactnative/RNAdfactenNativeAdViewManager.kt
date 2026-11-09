package com.adfacten.reactnative

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.RNAdfactenNativeAdViewManagerDelegate
import com.facebook.react.viewmanagers.RNAdfactenNativeAdViewManagerInterface

@ReactModule(name = RNAdfactenNativeAdViewManager.NAME)
class RNAdfactenNativeAdViewManager :
  SimpleViewManager<RNAdfactenNativeAdView>(),
  RNAdfactenNativeAdViewManagerInterface<RNAdfactenNativeAdView> {

  private val delegate = RNAdfactenNativeAdViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<RNAdfactenNativeAdView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext) = RNAdfactenNativeAdView(context)

  @ReactProp(name = "placementId")
  override fun setPlacementId(view: RNAdfactenNativeAdView, value: String?) {
    view.placementId = value?.trim().orEmpty()
  }

  @ReactProp(name = "templateType")
  override fun setTemplateType(view: RNAdfactenNativeAdView, value: String?) {
    view.template = if (value == "small") "small" else "medium"
  }

  @ReactProp(name = "titleColor", customType = "Color")
  override fun setTitleColor(view: RNAdfactenNativeAdView, value: Int?) {
    view.titleColor = value
  }

  @ReactProp(name = "bodyColor", customType = "Color")
  override fun setBodyColor(view: RNAdfactenNativeAdView, value: Int?) {
    view.bodyColor = value
  }

  @ReactProp(name = "secondaryColor", customType = "Color")
  override fun setSecondaryColor(view: RNAdfactenNativeAdView, value: Int?) {
    view.secondaryColor = value
  }

  @ReactProp(name = "callToActionColor", customType = "Color")
  override fun setCallToActionColor(view: RNAdfactenNativeAdView, value: Int?) {
    view.callToActionColor = value
  }

  @ReactProp(name = "callToActionTextColor", customType = "Color")
  override fun setCallToActionTextColor(view: RNAdfactenNativeAdView, value: Int?) {
    view.callToActionTextColor = value
  }

  @ReactProp(name = "adLabelColor", customType = "Color")
  override fun setAdLabelColor(view: RNAdfactenNativeAdView, value: Int?) {
    view.adLabelColor = value
  }

  @ReactProp(name = "titleFontSize")
  override fun setTitleFontSize(view: RNAdfactenNativeAdView, value: Float) {
    view.titleFontSize = value
  }

  @ReactProp(name = "bodyFontSize")
  override fun setBodyFontSize(view: RNAdfactenNativeAdView, value: Float) {
    view.bodyFontSize = value
  }

  @ReactProp(name = "callToActionCornerRadius", defaultFloat = -1f)
  override fun setCallToActionCornerRadius(view: RNAdfactenNativeAdView, value: Float) {
    view.callToActionCornerRadius = value
  }

  @ReactProp(name = "mediaCornerRadius", defaultFloat = -1f)
  override fun setMediaCornerRadius(view: RNAdfactenNativeAdView, value: Float) {
    view.mediaCornerRadius = value
  }

  override fun onAfterUpdateTransaction(view: RNAdfactenNativeAdView) {
    super.onAfterUpdateTransaction(view)
    view.commit()
  }

  override fun onDropViewInstance(view: RNAdfactenNativeAdView) {
    view.destroy()
    super.onDropViewInstance(view)
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    AdViewEvent.exportedTypes(AdViewEvent.NAMES)

  companion object {
    const val NAME = "RNAdfactenNativeAdView"
  }
}
