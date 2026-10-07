package com.aevren.xy

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.graphics.Color
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.math.roundToInt

class MainActivity : Activity() {
    companion object {
        private const val HOME = "https://tusumy.github.io/aevren-xy/"
        private const val FILE_CHOOSER = 7001
        private const val AUDIO_PERMISSION = 7002
    }

    private lateinit var webView: WebView
    private var launchSplash: View? = null
    private var pageRevealed = false
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingAudioPermission: PermissionRequest? = null

    private val http = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(180, TimeUnit.SECONDS)
        .writeTimeout(180, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    @SuppressLint("SetJavaScriptEnabled", "AddJavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        val root = FrameLayout(this)
        root.setBackgroundColor(Color.rgb(220, 233, 227))

        webView = WebView(this)
        webView.setBackgroundColor(0xFFDCE9E3.toInt())
        webView.alpha = 0f
        webView.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        root.addView(webView)

        launchSplash = buildLaunchSplash()
        root.addView(launchSplash)

        setContentView(root)
        applyImmersiveUi()

        if ((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
            setSupportMultipleWindows(false)
            cacheMode = WebSettings.LOAD_NO_CACHE
            userAgentString = "$userAgentString AevrenXY/Android"
        }

        installImeInsetBridge()

        webView.addJavascriptInterface(NativeHttpBridge(webView, http), "AevrenNative")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                val allowed = uri.scheme == "https" &&
                    uri.host == "tusumy.github.io" &&
                    (uri.path ?: "/").startsWith("/aevren-xy")
                if (allowed) return false
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                return true
            }

            override fun onPageCommitVisible(view: WebView, url: String) {
                super.onPageCommitVisible(view, url)
                revealWebContent()
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                revealWebContent()
                applyImmersiveUi()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    view.requestApplyInsets()
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback
                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                return try {
                    startActivityForResult(intent, FILE_CHOOSER)
                    true
                } catch (_: Exception) {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = null
                    false
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                val wantsAudio = request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                if (!wantsAudio) {
                    request.deny()
                    return
                }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                } else {
                    pendingAudioPermission?.deny()
                    pendingAudioPermission = request
                    requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), AUDIO_PERMISSION)
                }
            }
        }

        if (savedInstanceState == null) {
            webView.loadUrl("${HOME}?app=android&shell=5&t=${System.currentTimeMillis()}")
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()

    private fun buildLaunchSplash(): View {
        val overlay = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(220, 233, 227))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
        }

        val icon = ImageView(this).apply {
            setImageResource(com.aevren.xy.R.drawable.ic_launcher_foreground)
            scaleType = ImageView.ScaleType.FIT_CENTER
            layoutParams = LinearLayout.LayoutParams(dp(176), dp(176))
        }
        column.addView(icon)

        val title = TextView(this).apply {
            text = "砚屿"
            textSize = 29f
            setTextColor(Color.rgb(41, 68, 59))
            gravity = Gravity.CENTER
            letterSpacing = 0.18f
            setPadding(0, dp(12), 0, 0)
        }
        column.addView(title, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        val subtitle = TextView(this).apply {
            text = "回家了"
            textSize = 12f
            setTextColor(Color.argb(145, 41, 68, 59))
            gravity = Gravity.CENTER
            letterSpacing = 0.12f
            setPadding(0, dp(8), 0, 0)
        }
        column.addView(subtitle, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        overlay.addView(column, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        ))
        return overlay
    }

    private fun revealWebContent() {
        if (pageRevealed) return
        pageRevealed = true
        webView.animate().alpha(1f).setDuration(220).start()
        launchSplash?.animate()?.alpha(0f)?.setDuration(260)?.withEndAction {
            (launchSplash?.parent as? FrameLayout)?.removeView(launchSplash)
            launchSplash = null
        }?.start()
    }

    private fun installImeInsetBridge() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return

        webView.setOnApplyWindowInsetsListener { _, insets ->
            val imeBottomPx = insets.getInsets(WindowInsets.Type.ime()).bottom
            val navBottomPx = insets.getInsets(WindowInsets.Type.navigationBars()).bottom
            val effectivePx = (imeBottomPx - navBottomPx).coerceAtLeast(0)
            val density = resources.displayMetrics.density.coerceAtLeast(1f)
            val cssBottom = (effectivePx / density).roundToInt()

            webView.post {
                webView.evaluateJavascript(
                    "window.__xyNativeImeBottom && window.__xyNativeImeBottom($cssBottom);",
                    null
                )
            }
            insets
        }
    }

    private fun applyImmersiveUi() {
        @Suppress("DEPRECATION")
        runCatching {
            window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersiveUi()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != FILE_CHOOSER) return
        val result = if (resultCode == RESULT_OK) WebChromeClient.FileChooserParams.parseResult(resultCode, data) else null
        fileCallback?.onReceiveValue(result)
        fileCallback = null
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != AUDIO_PERMISSION) return
        val request = pendingAudioPermission ?: return
        pendingAudioPermission = null
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
        } else request.deny()
    }
}

private class NativeHttpBridge(
    private val webView: WebView,
    private val client: OkHttpClient
) {
    @JavascriptInterface
    fun request(id: String, raw: String) {
        try {
            val input = JSONObject(raw)
            val url = input.optString("url")
            if (!url.startsWith("https://") && !url.startsWith("http://")) {
                reject(id, "Only http/https URLs are supported")
                return
            }

            val method = input.optString("method", "GET").uppercase()
            val headerJson = input.optJSONObject("headers") ?: JSONObject()
            val requestBuilder = Request.Builder().url(url)
            val names = headerJson.keys()
            while (names.hasNext()) {
                val name = names.next()
                if (name.equals("host", true) || name.equals("content-length", true)) continue
                requestBuilder.addHeader(name, headerJson.optString(name))
            }
            if (requestBuilder.build().header("User-Agent") == null) {
                requestBuilder.header("User-Agent", "AevrenXY/0.1 Android")
            }

            val body = buildBody(input.optJSONObject("body"), headerJson)
            val requestBody = when {
                method == "GET" || method == "HEAD" -> null
                body != null -> body
                else -> ByteArray(0).toRequestBody(null)
            }
            requestBuilder.method(method, requestBody)