package com.adfacten.reactnative

import android.view.View
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event

/** A direct event of one of our views, e.g. `topAdLoaded` (`onAdLoaded` in JS). */
internal class AdViewEvent(
  surfaceId: Int,
  viewTag: Int,
  private val name: String,
  private val data: WritableMap?,
) : Event<AdViewEvent>(surfaceId, viewTag) {
  override fun getEventName(): String = name
  override fun canCoalesce(): Boolean = false
  override fun getEventData(): WritableMap = data ?: Arguments.createMap()

  companion object {
    val NAMES = listOf("topAdLoaded", "topAdFailedToLoad", "topAdImpression", "topAdClicked", "topAdLayout")

    fun exportedTypes(names: List<String>): MutableMap<String, Any> =
      names.associateWith { mapOf("registrationName" to "on" + it.removePrefix("top")) }.toMutableMap()
  }
}

// getEventDispatcher(context) only exists in recent React Native versions; keep the older call.
@Suppress("DEPRECATION")
internal fun View.dispatchAdEvent(name: String, data: WritableMap? = null) {
  val ctx = context as? ReactContext ?: return
  val dispatcher = UIManagerHelper.getEventDispatcherForReactTag(ctx, id) ?: return
  dispatcher.dispatchEvent(AdViewEvent(UIManagerHelper.getSurfaceId(this), id, name, data))
}
