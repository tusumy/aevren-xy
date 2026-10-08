package com.aevren.xy

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.media.MediaRecorder
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
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
import java.io.File
import java.io.IOException
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlin.math.roundToInt

class MainActivity : Activity() {
    companion object {
        private const val HOME = "https://tusumy.github.io/aevren-xy/"
        private const val FILE_CHOOSER = 7001
        const val AUDIO_PERMISSION = 7002
    }

    private lateinit var webView: WebView
    private var launchSplash: View? = null
    private var pageRevealed = false
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingAudioPermission: PermissionRequest? = null
    private var nativeVoiceBridge: NativeVoiceBridge? = null

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
        nativeVoiceBridge = NativeVoiceBridge(this, webView)
        webView.addJavascriptInterface(nativeVoiceBridge!!, "AevrenVoiceNative")
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
            webView.loadUrl("${HOME}?app=android&shell=6&t=${System.currentTimeMillis()}")
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

    override fun onDestroy() {
        nativeVoiceBridge?.shutdown()
        nativeVoiceBridge = null
        super.onDestroy()
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


private class NativeVoiceBridge(
    private val activity: Activity,
    private val webView: WebView
) {
    @Volatile private var ttsReady = false
    private var tts: TextToSpeech? = null
    private var recorder: MediaRecorder? = null
    private var recordingFile: File? = null

    init {
        activity.runOnUiThread {
            tts = TextToSpeech(activity.applicationContext) { status ->
                ttsReady = status == TextToSpeech.SUCCESS
                if (ttsReady) {
                    tts?.language = Locale.SIMPLIFIED_CHINESE
                    tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(utteranceId: String?) = Unit
                        override fun onDone(utteranceId: String?) { notifyTtsDone(utteranceId, null) }
                        @Deprecated("Deprecated in Java")
                        override fun onError(utteranceId: String?) { notifyTtsDone(utteranceId, "tts_error") }
                        override fun onError(utteranceId: String?, errorCode: Int) { notifyTtsDone(utteranceId, "tts_error_" + errorCode) }
                    })
                }
            }
        }
    }

    @JavascriptInterface
    fun listVoices(): String = try {
        val arr = JSONArray()
        val voices = tts?.voices?.sortedWith(compareBy({ it.locale?.toLanguageTag().orEmpty() }, { it.name.orEmpty() })).orEmpty()
        for (voice in voices) {
            arr.put(
                JSONObject()
                    .put("id", voice.name)
                    .put("name", voice.name)
                    .put("lang", voice.locale?.toLanguageTag().orEmpty())
                    .put("network", voice.isNetworkConnectionRequired)
            )
        }
        arr.toString()
    } catch (_: Exception) { "[]" }

    @JavascriptInterface
    fun speak(text: String, voiceName: String, utteranceId: String): String {
        if (!ttsReady) return JSONObject().put("ok", false).put("error", "tts_not_ready").toString()
        val value = text.trim()
        if (value.isEmpty()) return JSONObject().put("ok", false).put("error", "empty_text").toString()
        activity.runOnUiThread {
            val engine = tts ?: return@runOnUiThread
            val chosen = if (voiceName.isNotBlank()) {
                engine.voices?.firstOrNull { it.name == voiceName }
            } else {
                engine.voices?.firstOrNull { it.locale?.language == Locale.CHINESE.language && !it.isNetworkConnectionRequired }
                    ?: engine.voices?.firstOrNull { it.locale?.language == Locale.CHINESE.language }
            }
            if (chosen != null) engine.voice = chosen else engine.language = Locale.SIMPLIFIED_CHINESE
            engine.speak(value, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
        }
        return JSONObject().put("ok", true).toString()
    }

    @JavascriptInterface
    fun stopTts() { activity.runOnUiThread { tts?.stop() } }

    @JavascriptInterface
    fun isTtsSpeaking(): Boolean = tts?.isSpeaking == true

    @JavascriptInterface
    @Synchronized
    fun startRecording(): String {
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            activity.runOnUiThread {
                activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), MainActivity.AUDIO_PERMISSION)
            }
            return JSONObject().put("ok", false).put("error", "permission_requested").toString()
        }
        if (recorder != null) return JSONObject().put("ok", false).put("error", "already_recording").toString()
        return try {
            val file = File(activity.cacheDir, "aevren-voice-" + System.currentTimeMillis() + ".m4a")
            val mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(activity)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC)
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            mediaRecorder.setAudioEncodingBitRate(64_000)
            mediaRecorder.setAudioSamplingRate(44_100)
            mediaRecorder.setOutputFile(file.absolutePath)
            mediaRecorder.prepare()
            mediaRecorder.start()
            recorder = mediaRecorder
            recordingFile = file
            JSONObject().put("ok", true).put("mime", "audio/mp4").toString()
        } catch (error: Exception) {
            runCatching { recorder?.release() }
            recorder = null
            recordingFile?.delete()
            recordingFile = null
            JSONObject().put("ok", false).put("error", error.message ?: error.javaClass.simpleName).toString()
        }
    }

    @JavascriptInterface
    @Synchronized
    fun stopRecording(): String {
        val active = recorder ?: return JSONObject().put("ok", false).put("error", "not_recording").toString()
        val file = recordingFile
        recorder = null
        recordingFile = null
        return try {
            active.stop()
            active.release()
            if (file == null || !file.exists()) {
                JSONObject().put("ok", false).put("error", "missing_recording").toString()
            } else {
                val bytes = file.readBytes()
                file.delete()
                JSONObject()
                    .put("ok", true)
                    .put("mime", "audio/mp4")
                    .put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
                    .toString()
            }
        } catch (error: Exception) {
            runCatching { active.release() }
            file?.delete()
            JSONObject().put("ok", false).put("error", error.message ?: error.javaClass.simpleName).toString()
        }
    }

    fun shutdown() {
        synchronized(this) {
            runCatching { recorder?.stop() }
            runCatching { recorder?.release() }
            recorder = null
            recordingFile?.delete()
            recordingFile = null
        }
        activity.runOnUiThread {
            tts?.stop()
            tts?.shutdown()
            tts = null
            ttsReady = false
        }
    }

    private fun notifyTtsDone(utteranceId: String?, error: String?) {
        val id = utteranceId ?: return
        val js = if (error == null) {
            "window.__xyNativeTtsDone && window.__xyNativeTtsDone(" + JSONObject.quote(id) + ");"
        } else {
            "window.__xyNativeTtsError && window.__xyNativeTtsError(" + JSONObject.quote(id) + ", " + JSONObject.quote(error) + ");"
        }
        webView.post { webView.evaluateJavascript(js, null) }
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

            client.newCall(requestBuilder.build()).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    reject(id, e.message ?: "Network request failed")
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use {
                        val bytes = it.body?.bytes() ?: ByteArray(0)
                        val type = it.header("content-type").orEmpty().lowercase()
                        val textual = type.startsWith("text/") ||
                            type.contains("json") || type.contains("xml") ||
                            type.contains("javascript") || type.contains("event-stream") ||
                            type.contains("x-www-form-urlencoded")
                        val headers = JSONObject()
                        for (name in it.headers.names()) headers.put(name, it.headers.values(name).joinToString(", "))
                        val payload = JSONObject()
                            .put("status", it.code)
                            .put("statusText", it.message)
                            .put("headers", headers)
                        if (textual) payload.put("body", bytes.toString(Charsets.UTF_8))
                        else payload.put("bodyBase64", Base64.encodeToString(bytes, Base64.NO_WRAP))
                        resolve(id, payload.toString())
                    }
                }
            })
        } catch (error: Exception) {
            reject(id, error.message ?: error.javaClass.simpleName)
        }
    }

    private fun buildBody(body: JSONObject?, headers: JSONObject): RequestBody? {
        if (body == null) return null
        return when (body.optString("kind", "none")) {
            "none" -> null
            "text" -> body.optString("data").toRequestBody(
                body.optString("contentType", headers.optString("content-type")).toMediaTypeOrNull()
            )
            "base64" -> Base64.decode(body.optString("base64"), Base64.DEFAULT).toRequestBody(
                body.optString("contentType", "application/octet-stream").toMediaTypeOrNull()
            )
            "multipart" -> {
                val builder = MultipartBody.Builder().setType(MultipartBody.FORM)
                val parts = body.optJSONArray("parts") ?: JSONArray()
                for (i in 0 until parts.length()) {
                    val part = parts.getJSONObject(i)
                    val name = part.optString("name")
                    if (part.optString("type") == "file") {
                        val bytes = Base64.decode(part.optString("base64"), Base64.DEFAULT)
                        val fileBody = bytes.toRequestBody(part.optString("contentType", "application/octet-stream").toMediaTypeOrNull())
                        builder.addFormDataPart(name, part.optString("filename", "blob"), fileBody)
                    } else builder.addFormDataPart(name, part.optString("value"))
                }
                builder.build()
            }
            else -> null
        }
    }

    private fun resolve(id: String, payload: String) {
        val js = "window.__xyNativeResolve && window.__xyNativeResolve(${JSONObject.quote(id)}, ${JSONObject.quote(payload)});"
        webView.post { webView.evaluateJavascript(js, null) }
    }

    private fun reject(id: String, message: String) {
        val js = "window.__xyNativeReject && window.__xyNativeReject(${JSONObject.quote(id)}, ${JSONObject.quote(message)});"
        webView.post { webView.evaluateJavascript(js, null) }
    }
}
