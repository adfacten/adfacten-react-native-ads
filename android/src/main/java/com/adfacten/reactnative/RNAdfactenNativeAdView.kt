package com.adfacten.reactnative

import android.content.Context
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.adfacten.ads.AdError
import com.adfacten.ads.AdLoadCallback
import com.adfacten.ads.NativeAd
import com.adfacten.ads.NativeAdListener
import com.adfacten.ads.NativeAdView
import com.facebook.react.bridge.Arguments
import kotlin.math.roundToInt

/**
 * A native ad drawn with a built-in template. The SDK's [NativeAdView] wraps the template, so the
 * SDK itself records the impression, the viewable impression and clicks.
 */
class RNAdfactenNativeAdView(context: Context) : FrameLayout(context) {
  var placementId: String = ""
  var template: String = "medium"
  var titleColor: Int? = null
  var bodyColor: Int? = null
  var secondaryColor: Int? = null
  var callToActionColor: Int? = null
  var callToActionTextColor: Int? = null
  var adLabelColor: Int? = null
  var titleFontSize: Float = 0f
  var bodyFontSize: Float = 0f
  var callToActionCornerRadius: Float = -1f
  var mediaCornerRadius: Float = -1f

  private var ad: NativeAd? = null
  private var adView: NativeAdView? = null
  private var loadedPlacement: String? = null
  private var builtTemplate: String? = null
  private var parts: Parts? = null
  private var loadToken = 0
  private var lastReportedHeight = -1
  private var destroyed = false

  private val density get() = resources.displayMetrics.density
  private fun dp(v: Float) = (v * density).roundToInt()

  fun commit() {
    if (destroyed) return
    if (placementId != loadedPlacement) {
      loadedPlacement = placementId
      load()
      return
    }
    val current = ad ?: return
    // Rebinding would start a new impression, so only a template switch rebuilds the view;
    // colors and sizes are applied in place.
    if (template != builtTemplate) bind(current) else parts?.let { applyStyle(it); remeasure() }
  }

  private fun load() {
    releaseAd()
    reportHeight(0)
    val plc = placementId
    if (plc.isBlank()) return
    val token = ++loadToken
    NativeAd.load(context, plc, object : AdLoadCallback<NativeAd> {
      override fun onLoaded(ad: NativeAd) {
        if (destroyed || token != loadToken) {
          ad.destroy()
          return
        }
        this@RNAdfactenNativeAdView.ad = ad
        ad.listener = object : NativeAdListener {
          override fun onShown() = dispatchAdEvent("topAdImpression")
          override fun onClicked() = dispatchAdEvent("topAdClicked")
        }
        bind(ad)
        dispatchAdEvent("topAdLoaded", Arguments.createMap().apply {
          putString("title", ad.title)
          putString("body", ad.body)
          putString("brand", ad.brand)
          putString("callToAction", ad.callToAction)
          putString("adLabel", ad.adLabel)
        })
      }

      override fun onFailed(error: AdError) {
        if (destroyed || token != loadToken) return
        dispatchAdEvent("topAdFailedToLoad", AdErrors.viewEvent(error))
      }
    })
  }

  private fun bind(ad: NativeAd) {
    adView?.let {
      it.setNativeAd(null)
      removeView(it)
    }
    val view = buildTemplate(ad)
    addView(view, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
    adView = view
    builtTemplate = template
    view.setNativeAd(ad)
    remeasure()
  }

  fun destroy() {
    destroyed = true
    loadToken++
    releaseAd()
  }

  private fun releaseAd() {
    adView?.let {
      it.setNativeAd(null)
      removeView(it)
    }
    adView = null
    ad?.listener = null
    ad?.destroy()
    ad = null
    parts = null
    builtTemplate = null
  }

  // ---- Template ----

  private fun text(lines: Int, bold: Boolean = false) = TextView(context).apply {
    maxLines = lines
    ellipsize = TextUtils.TruncateAt.END
    includeFontPadding = false
    if (bold) setTypeface(typeface, Typeface.BOLD)
  }

  private fun badge(): TextView = TextView(context).apply {
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
    setTypeface(typeface, Typeface.BOLD)
    setTextColor(Color.BLACK)
    setPadding(dp(4f), dp(1f), dp(4f), dp(1f))
  }

  private fun callToAction(fullWidth: Boolean): TextView = TextView(context).apply {
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
    setTypeface(typeface, Typeface.BOLD)
    gravity = Gravity.CENTER
    maxLines = 1
    ellipsize = TextUtils.TruncateAt.END
    setPadding(dp(14f), 0, dp(14f), 0)
    minimumHeight = dp(if (fullWidth) 44f else 36f)
    isClickable = true
  }

  private fun rounded(view: ImageView, radiusDp: Float) {
    val r = dp(radiusDp).toFloat()
    view.outlineProvider = object : ViewOutlineProvider() {
      override fun getOutline(v: View, outline: Outline) = outline.setRoundRect(0, 0, v.width, v.height, r)
    }
    view.clipToOutline = r > 0f
    view.invalidateOutline()
  }

  private class Parts(
    val small: Boolean,
    val title: TextView,
    val body: TextView,
    val brand: TextView,
    val label: TextView,
    val cta: TextView,
    val media: ImageView?,
  )

  private fun applyStyle(p: Parts) {
    p.title.setTextSize(TypedValue.COMPLEX_UNIT_SP, if (titleFontSize > 0) titleFontSize else if (p.small) 15f else 16f)
    p.title.setTextColor(titleColor ?: DEFAULT_TITLE)
    p.body.setTextSize(TypedValue.COMPLEX_UNIT_SP, if (bodyFontSize > 0) bodyFontSize else 13f)
    p.body.setTextColor(bodyColor ?: DEFAULT_BODY)
    p.brand.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
    p.brand.setTextColor(secondaryColor ?: DEFAULT_SECONDARY)
    p.label.background = GradientDrawable().apply {
      setColor(adLabelColor ?: DEFAULT_BADGE)
      cornerRadius = dp(3f).toFloat()
    }
    p.cta.setTextColor(callToActionTextColor ?: Color.WHITE)
    p.cta.background = GradientDrawable().apply {
      setColor(callToActionColor ?: DEFAULT_CTA)
      cornerRadius = dp(if (callToActionCornerRadius >= 0) callToActionCornerRadius else 6f).toFloat()
    }
    p.media?.let { rounded(it, if (mediaCornerRadius >= 0) mediaCornerRadius else 6f) }
  }

  private fun buildTemplate(ad: NativeAd): NativeAdView {
    val small = template == "small"
    val root = NativeAdView(context)
    val title = text(if (small) 1 else 2, bold = true)
    val body = text(if (small) 2 else 3)
    val brand = text(1)
    val label = badge()
    val icon = ImageView(context).apply { scaleType = ImageView.ScaleType.CENTER_CROP }
    rounded(icon, 6f)
    val content: ViewGroup
    val cta = callToAction(fullWidth = !small)
    var media: ImageView? = null

    if (small) {
      content = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(12f), dp(12f), dp(12f), dp(12f))
        if (ad.icon != null) {
          addView(icon, LinearLayout.LayoutParams(dp(56f), dp(56f)).apply { marginEnd = dp(12f) })
        }
        addView(LinearLayout(context).apply {
          orientation = LinearLayout.VERTICAL
          addView(row(label, brand))
          addView(title, margins(top = 4f))
          addView(body, margins(top = 2f))
        }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        addView(cta, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
          marginStart = dp(12f)
        })
      }
    } else {
      val image = ImageView(context).apply {
        scaleType = ImageView.ScaleType.CENTER_CROP
        setBackgroundColor(0x11000000)
      }
      media = image
      val ratio = mediaRatio(ad)
      content = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(12f), dp(12f), dp(12f), dp(12f))
        addView(LinearLayout(context).apply {
          orientation = LinearLayout.HORIZONTAL
          gravity = Gravity.CENTER_VERTICAL
          if (ad.icon != null) {
            addView(icon, LinearLayout.LayoutParams(dp(40f), dp(40f)).apply { marginEnd = dp(10f) })
          }
          addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            addView(title)
            addView(row(label, brand), margins(top = 4f))
          }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        })
        addView(body, margins(top = 8f))
        if (ad.image != null) addView(AspectFrame(context, ratio).apply { addView(image) }, margins(top = 10f))
        addView(cta, margins(top = 10f))
      }
      root.imageView = image
    }

    root.callToActionView = cta

    root.titleView = title
    root.bodyView = body
    root.brandView = brand
    root.adLabelView = label
    root.iconView = if (ad.icon != null) icon else null
    root.addView(content, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
    parts = Parts(small, title, body, brand, label, cta, media).also { applyStyle(it) }
    return root
  }

  private fun row(vararg views: View) = LinearLayout(context).apply {
    orientation = LinearLayout.HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
    views.forEachIndexed { i, v ->
      addView(v, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        if (i > 0) marginStart = dp(6f)
      })
    }
  }

  private fun margins(top: Float) = LinearLayout.LayoutParams(
    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT,
  ).apply { topMargin = dp(top) }

  private fun mediaRatio(ad: NativeAd): Float {
    val w = if (ad.imageWidth > 0) ad.imageWidth else ad.image?.width ?: 0
    val h = if (ad.imageHeight > 0) ad.imageHeight else ad.image?.height ?: 0
    val r = if (w > 0 && h > 0) w.toFloat() / h else 1.91f
    return r.coerceIn(0.75f, 3f)
  }

  /** Keeps the media at the creative's aspect ratio for any width. */
  private class AspectFrame(context: Context, private val ratio: Float) : FrameLayout(context) {
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
      val w = MeasureSpec.getSize(widthMeasureSpec)
      val h = (w / ratio).roundToInt()
      super.onMeasure(
        MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY),
      )
    }
  }

  // ---- Layout ----

  /** Measures the template at the current width and tells JS the height it needs. */
  private fun remeasure() {
    val view = adView ?: return
    if (width <= 0) return
    view.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED),
    )
    reportHeight(view.measuredHeight)
    view.layout(0, 0, width, view.measuredHeight)
  }

  private fun reportHeight(px: Int) {
    if (px == lastReportedHeight) return
    lastReportedHeight = px
    dispatchAdEvent("topAdLayout", Arguments.createMap().apply { putDouble("height", px / density.toDouble()) })
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    if (w != oldw) post { remeasure() }
  }

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

  private companion object {
    const val DEFAULT_TITLE = 0xFF1F1F1F.toInt()
    const val DEFAULT_BODY = 0xFF5F6368.toInt()
    const val DEFAULT_SECONDARY = 0xFF80868B.toInt()
    const val DEFAULT_CTA = 0xFF1A73E8.toInt()
    const val DEFAULT_BADGE = 0xFFFBC02D.toInt()
  }
}
