package com.aevren.xy

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
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

class MainActivity : Activity() {
    companion object {
        private const val HOME = "https://tusumy.github.io/aevren-xy/"
        private const val FILE_CHOOSER = 7001
        private const val AUDIO_PERMISSION = 7002
    }

    private lateinit var webView: WebView
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

        webView = WebView(this)
        webView.setBackgroundColor(0xFFF6F2EC.toInt())
        webView.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        setContentView(webView)

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
            userAgentString = "$userAgentString AevrenXY/Android"
        }

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

        if (savedInstanceState == null) webView.loadUrl("${HOME}?app=android")
        else webView.restoreState(savedInstanceState)
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
