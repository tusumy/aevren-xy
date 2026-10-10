package com.aevren.xy

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import android.webkit.WebView
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.ZipInputStream
import kotlin.math.abs
import kotlin.math.max

/**
 * Offline speech recognition. Chinese Vosk model is bundled into the APK at build time.
 * No user account, network service, or voice API key is required after installation.
 * A single AudioRecord session is shared between phone turns and voice notes.
 */
internal class OfflineSpeech(private val activity: Activity, private val webView: WebView) {
    private val sampleRate = 16000
    private val busy = AtomicBoolean(false)
    private val closed = AtomicBoolean(false)
    @Volatile private var model: Model? = null
    @Volatile private var modelError = ""
    @Volatile private var modelLoading = true

    private class Session(
        val note: Boolean,
        val recorder: AudioRecord,
        val recognizer: Recognizer
    ) {
        @Volatile var running = true
        @Volatile var cancelled = false
        @Volatile var transcript = ""
        @Volatile var rawAudio: ByteArray = byteArrayOf()
        val pcm = ByteArrayOutputStream()
        lateinit var thread: Thread
    }

    @Volatile private var session: Session? = null

    init {
        Thread({
            try {
                val dir = prepareBundledModel()
                if (!closed.get()) model = Model(dir.absolutePath)
            } catch (error: Throwable) {
                modelError = error.message ?: error.javaClass.simpleName
            } finally {
                modelLoading = false
            }
        }, "xy-offline-model").apply { isDaemon = true; start() }
    }

    private fun prepareBundledModel(): File {
        val dir = File(activity.filesDir, "vosk-zh-cn-small-0.22")
        if (File(dir, "am/final.mdl").isFile) return dir
        val temp = File(activity.filesDir, "vosk-zh-cn-small-install")
        temp.deleteRecursively()
        if (!temp.mkdirs()) throw IOException("offline_model_storage_unavailable")
        try {
            activity.assets.open("vosk-small-cn.zip").use { stream ->
                ZipInputStream(stream.buffered()).use { zip ->
                    var total = 0L
                    var entries = 0
                    while (true) {
                        val entry = zip.nextEntry ?: break
                        entries++
                        if (entries > 10000) throw IOException("offline_model_invalid_archive")
                        val relative = entry.name.replace('\\', '/').substringAfter('/')
                        if (relative.isBlank()) { zip.closeEntry(); continue }
                        val out = File(temp, relative)
                        if (!out.canonicalPath.startsWith(temp.canonicalPath + File.separator))
                            throw IOException("offline_model_invalid_path")
                        if (entry.isDirectory) out.mkdirs()
                        else {
                            out.parentFile?.mkdirs()
                            out.outputStream().use { output ->
                                val buffer = ByteArray(16384)
                                while (true) {
                                    val count = zip.read(buffer)
                                    if (count <= 0) break
                                    total += count
                                    if (total > 350_000_000) throw IOException("offline_model_too_large")
                                    output.write(buffer, 0, count)
                                }
                            }
                        }
                        zip.closeEntry()
                    }
                }
            }
            if (!File(temp, "am/final.mdl").isFile) throw IOException("offline_model_contents_missing")
            dir.deleteRecursively()
            if (!temp.renameTo(dir)) throw IOException("offline_model_install_failed")
            return dir
        } catch (error: Throwable) {
            temp.deleteRecursively()
            throw error
        }
    }

    fun status(): String = JSONObject()
        .put("ok", model != null)
        .put("state", if (model != null) "ready" else if (modelLoading) "preparing" else "error")
        .put("error", modelError)
        .toString()

    @Synchronized fun startPhoneTurn(): String = start(false)
    @Synchronized fun startVoiceNote(): String = start(true)

    private fun start(note: Boolean): String {
        if (closed.get()) return problem("offline_shutdown")
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
            return problem("permission_requested")
        val loaded = model ?: return problem(if (modelLoading) "offline_model_preparing" else "offline_model_failed_" + modelError)
        if (!busy.compareAndSet(false, true)) return problem("already_listening")
        var recorder: AudioRecord? = null
        var recognizer: Recognizer? = null
        try {
            val minBytes = AudioRecord.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            if (minBytes < 0) throw IOException("microphone_pcm_unavailable")
            recorder = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, sampleRate,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, max(minBytes, 8192))
            if (recorder.state != AudioRecord.STATE_INITIALIZED) throw IOException("microphone_initialization_failed")
            recognizer = Recognizer(loaded, sampleRate.toFloat())
            recorder.startRecording()
            val s = Session(note, recorder, recognizer)
            session = s
            s.thread = Thread({ capture(s) }, if (note) "xy-offline-note" else "xy-offline-call").apply {
                isDaemon = true
                start()
            }
            return JSONObject().put("ok", true).put("mode", if (note) "note" else "call").toString()
        } catch (error: Throwable) {
            runCatching { recorder?.release() }
            runCatching { recognizer?.close() }
            busy.set(false)
            session = null
            return problem(error.message ?: error.javaClass.simpleName)
        }
    }

    private fun capture(s: Session) {
        val data = ByteArray(3200)
        var heardVoice = false
        var heardSince = 0L
        var lastVoice = System.currentTimeMillis()
        val started = lastVoice
        var lastPartialAt = 0L
        var latest = ""
        try {
            if (!s.note) event("state", "ready")
            while (s.running && !closed.get()) {
                val n = s.recorder.read(data, 0, data.size)
                if (n <= 0) {
                    if (n < 0) throw IOException("microphone_read_" + n)
                    continue
                }
                if (s.note) {
                    if (s.pcm.size() + n > 3_200_000) break
                    s.pcm.write(data, 0, n)
                }
                var sum = 0L
                for (i in 0 until (n - 1) step 2) {
                    val pcm = ((data[i + 1].toInt() shl 8) or (data[i].toInt() and 255)).toShort().toInt()
                    sum += abs(pcm.toLong())
                }
                val level = sum / max(1, n / 2)
                val now = System.currentTimeMillis()
                if (level > 230) {
                    if (!heardVoice) { heardVoice = true; heardSince = now; if (!s.note) event("state", "speech") }
                    lastVoice = now
                }
                if (s.recognizer.acceptWaveForm(data, n)) {
                    val text = JSONObject(s.recognizer.result).optString("text", "").trim()
                    if (text.isNotBlank()) latest = listOf(latest, text).filter { it.isNotBlank() }.joinToString(" ")
                } else if (!s.note && now - lastPartialAt > 380) {
                    val partial = JSONObject(s.recognizer.partialResult).optString("partial", "")
                    if (partial.isNotBlank()) event("partial", partial)
                    lastPartialAt = now
                }
                if (!s.note && ((heardVoice && now - heardSince > 250 && now - lastVoice > 900) || now - started > 11000)) break
                if (s.note && now - started > 90000) break
            }
            val final = JSONObject(s.recognizer.finalResult).optString("text", "").trim()
            s.transcript = listOf(latest, final).filter { it.isNotBlank() }.joinToString(" ").trim()
            if (s.note) s.rawAudio = makeWav(s.pcm.toByteArray())
            else if (!s.cancelled && !closed.get()) event("result", s.transcript)
        } catch (error: Throwable) {
            if (!s.note && !s.cancelled && !closed.get()) event("error", error.message ?: "offline_capture_failed")
        } finally {
            s.running = false
            runCatching { s.recorder.stop() }
            runCatching { s.recorder.release() }
            runCatching { s.recognizer.close() }
            if (!s.note) {
                if (session === s) session = null
                busy.set(false)
            }
        }
    }

    @Synchronized fun stopPhoneTurn(): String {
        val s = session ?: return problem("not_listening")
        if (s.note) return problem("note_recording")
        s.cancelled = true
        s.running = false
        runCatching { s.recorder.stop() }
        return JSONObject().put("ok", true).toString()
    }

    @Synchronized fun stopVoiceNote(): String {
        val s = session ?: return problem("not_recording")
        if (!s.note) return problem("phone_listening")
        s.running = false
        runCatching { s.recorder.stop() }
        s.thread.join(3000)
        if (s.thread.isAlive) return problem("offline_note_finishing")
        if (session === s) session = null
        busy.set(false)
        if (s.rawAudio.isEmpty()) return problem("offline_note_empty")
        return JSONObject().put("ok", true)
            .put("mime", "audio/wav")
            .put("base64", Base64.encodeToString(s.rawAudio, Base64.NO_WRAP))
            .put("transcript", s.transcript).toString()
    }

    @Synchronized fun shutdown() {
        closed.set(true)
        session?.let { it.cancelled = true; it.running = false; runCatching { it.recorder.stop() } }
        // Avoid closing a model while a background recognizer is using it.
    }

    private fun event(kind: String, value: String) {
        val handler = when (kind) {
            "result" -> "__xyNativeSttResult"
            "partial" -> "__xyNativeSttPartial"
            "error" -> "__xyNativeSttError"
            else -> "__xyNativeSttState"
        }
        val argument = JSONObject.quote(value)
        webView.post { webView.evaluateJavascript("window.$handler && window.$handler($argument);", null) }
    }

    private fun problem(code: String): String = JSONObject().put("ok", false).put("error", code).toString()

    private fun makeWav(pcm: ByteArray): ByteArray {
        val out = ByteArrayOutputStream(pcm.size + 44)
        fun name(text: String) { out.write(text.toByteArray(Charsets.US_ASCII)) }
        fun number(value: Int, size: Int) { for (shift in 0 until size) out.write((value ushr (shift * 8)) and 255) }
        name("RIFF");number(36 + pcm.size, 4);name("WAVE")
        name("fmt ");number(16,4);number(1,2);number(1,2)
        number(sampleRate,4);number(sampleRate*2,4);number(2,2);number(16,2)
        name("data");number(pcm.size,4);out.write(pcm)
        return out.toByteArray()
    }
}
