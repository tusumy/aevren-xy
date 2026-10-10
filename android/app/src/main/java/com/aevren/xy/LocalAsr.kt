package com.aevren.xy

import android.app.Activity
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.os.Handler
import android.os.Looper
import android.util.Base64
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import org.vosk.android.RecognitionListener
import org.vosk.android.SpeechService
import org.vosk.android.StorageService
import java.io.File
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.min

/**
 * Keyless Chinese ASR. The model comes from the APK, not from the user's chat API.
 * Mic recognition and recorded-audio transcription both use the same local model.
 * No microphone audio is transmitted by this class.
 */
internal class LocalAsr(
    private val activity: Activity,
    private val onMicState: (String, String) -> Unit,
    private val onMicDone: (String?, String?) -> Unit
) {
    private val main = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private var model: Model? = null
    private var loading = false
    private var loadError = ""
    private var pendingMic = false
    private var generation = 0
    private var speechService: SpeechService? = null
    private val pendingNotes = mutableListOf<() -> Unit>()
    private var closed = false

    fun isBundled(): Boolean = try {
        activity.assets.list("vosk-cn")?.contains("uuid") == true
    } catch (_: Exception) { false }

    init {
        if (isBundled()) main.post { prepare() }
    }

    private fun prepare() {
        if (model != null || loading || closed || !isBundled()) return
        loading = true
        loadError = ""
        StorageService.unpack(activity, "vosk-cn", "vosk-cn",
            { loaded ->
                if (closed) { loaded.close(); return@unpack }
                model = loaded
                loading = false
                if (pendingMic) startMicNow(generation)
                val jobs = pendingNotes.toList()
                pendingNotes.clear()
                jobs.forEach { it() }
            },
            { error ->
                loading = false
                loadError = error.message ?: "model_loading_failed"
                if (pendingMic) completeMic(generation, null, "离线识别模型加载失败：$loadError")
                val jobs = pendingNotes.toList()
                pendingNotes.clear()
                jobs.forEach { it() }
            })
    }

    fun startMic(): Boolean {
        if (!isBundled() || closed || pendingMic || speechService != null) return false
        generation++
        pendingMic = true
        val token = generation
        if (model == null) {
            onMicState("loading_model", "")
            if (loadError.isNotBlank() && !loading) loadError = ""
            prepare()
        } else startMicNow(token)
        return true
    }

    private fun startMicNow(token: Int) {
        if (!pendingMic || token != generation || closed) return
        try {
            val loaded = model ?: throw IllegalStateException(loadError.ifBlank { "offline_model_unavailable" })
            val recognizer = Recognizer(loaded, 16000.0f)
            val service = SpeechService(recognizer, 16000.0f)
            speechService = service
            onMicState("ready", "")
            var lastPartial = ""
            val listener = object : RecognitionListener {
                override fun onPartialResult(hypothesis: String?) {
                    if (token != generation) return
                    val partial = JSONObject(hypothesis ?: "{}").optString("partial").trim()
                    if (partial.isNotBlank()) {
                        lastPartial = partial
                        onMicState("speech", "")
                        onMicState("partial", partial)
                    }
                }

                override fun onResult(hypothesis: String?) {
                    if (token != generation) return
                    val result = JSONObject(hypothesis ?: "{}").optString("text").trim()
                    if (result.isNotBlank()) {
                        onMicState("processing", "")
                        completeMic(token, result, null)
                    }
                }

                override fun onFinalResult(hypothesis: String?) {
                    if (token != generation) return
                    val result = JSONObject(hypothesis ?: "{}").optString("text").trim()
                    completeMic(token, (result.ifBlank { lastPartial }).ifBlank { null }, null)
                }

                override fun onError(error: Exception?) {
                    completeMic(token, null, error?.message ?: "offline_recognition_failed")
                }

                override fun onTimeout() {
                    completeMic(token, null, "speech_no_match")
                }
            }
            if (!service.startListening(listener, 18000)) {
                completeMic(token, null, "offline_microphone_start_failed")
            }
        } catch (error: Exception) {
            completeMic(token, null, error.message ?: "offline_recognition_failed")
        }
    }

    private fun completeMic(token: Int, result: String?, error: String?) {
        if (token != generation || !pendingMic) return
        generation++
        pendingMic = false
        val service = speechService
        speechService = null
        try { service?.stop() } catch (_: Exception) {}
        try { service?.shutdown() } catch (_: Exception) {}
        if (!closed) onMicDone(result?.trim(), error)
    }

    fun stopMic() {
        generation++
        pendingMic = false
        val service = speechService
        speechService = null
        try { service?.stop() } catch (_: Exception) {}
        try { service?.shutdown() } catch (_: Exception) {}
    }

    fun transcribeBase64(encodedAudio: String, callback: (String?, String?) -> Unit) {
        if (!isBundled()) { callback(null, "offline_model_not_in_apk"); return }
        if (encodedAudio.length > 18_000_000) { callback(null, "recording_too_large"); return }
        val run = {
            val loaded = model
            if (loaded == null) callback(null, loadError.ifBlank { "offline_model_unavailable" })
            else worker.execute {
                try {
                    val bytes = Base64.decode(encodedAudio, Base64.DEFAULT)
                    val text = decodeAndRecognize(bytes, loaded)
                    main.post { if (!closed) callback(text, null) }
                } catch (error: Exception) {
                    main.post { if (!closed) callback(null, error.message ?: "offline_transcription_failed") }
                }
            }
        }
        main.post {
            if (closed) return@post
            if (model == null && loadError.isBlank()) {
                pendingNotes.add(run)
                prepare()
            } else run()
        }
    }

    private fun decodeAndRecognize(bytes: ByteArray, loaded: Model): String {
        if (bytes.size < 500) throw IllegalArgumentException("audio_too_short")
        val temp = File.createTempFile("xy-offline-", ".m4a", activity.cacheDir)
        var extractor: MediaExtractor? = null
        var decoder: MediaCodec? = null
        try {
            temp.writeBytes(bytes)
            extractor = MediaExtractor()
            extractor.setDataSource(temp.absolutePath)
            var track = -1
            var format: MediaFormat? = null
            for (i in 0 until extractor.trackCount) {
                val f = extractor.getTrackFormat(i)
                val mime = f.getString(MediaFormat.KEY_MIME) ?: ""
                if (mime.startsWith("audio/")) { track = i; format = f; break }
            }
            if (track < 0 || format == null) throw IllegalArgumentException("recording_has_no_audio")
            extractor.selectTrack(track)
            val mime = format.getString(MediaFormat.KEY_MIME) ?: throw IllegalArgumentException("audio_codec_unknown")
            decoder = MediaCodec.createDecoderByType(mime)
            decoder.configure(format, null, null, 0)
            decoder.start()
            var rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            var inputFinished = false
            var outputFinished = false
            val info = MediaCodec.BufferInfo()
            val phrases = mutableListOf<String>()
            Recognizer(loaded, 16000.0f).use { recognizer ->
                var loops = 0
                while (!outputFinished && loops++ < 120000) {
                    if (!inputFinished) {
                        val slot = decoder.dequeueInputBuffer(10000)
                        if (slot >= 0) {
                            val buffer = decoder.getInputBuffer(slot) ?: throw IllegalStateException("missing_input_buffer")
                            buffer.clear()
                            val size = extractor.readSampleData(buffer, 0)
                            if (size < 0) {
                                decoder.queueInputBuffer(slot, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                                inputFinished = true
                            } else {
                                decoder.queueInputBuffer(slot, 0, size, extractor.sampleTime, 0)
                                extractor.advance()
                            }
                        }
                    }
                    when (val slot = decoder.dequeueOutputBuffer(info, 10000)) {
                        MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                            val newFormat = decoder.outputFormat
                            rate = newFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                            channels = newFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                            if (newFormat.containsKey(MediaFormat.KEY_PCM_ENCODING) &&
                                newFormat.getInteger(MediaFormat.KEY_PCM_ENCODING) != 2) {
                                throw IllegalArgumentException("unsupported_audio_pcm_encoding")
                            }
                        }
                        MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
                        else -> if (slot >= 0) {
                            if (info.size > 0) {
                                val buffer = decoder.getOutputBuffer(slot) ?: throw IllegalStateException("missing_output_buffer")
                                buffer.position(info.offset)
                                buffer.limit(info.offset + info.size)
                                val pcm = ByteArray(info.size)
                                buffer.get(pcm)
                                val mono = toMono16k(pcm, rate, channels)
                                if (mono.isNotEmpty() && recognizer.acceptWaveForm(mono, mono.size)) {
                                    val segment = JSONObject(recognizer.result).optString("text").trim()
                                    if (segment.isNotEmpty()) phrases.add(segment)
                                }
                            }
                            outputFinished = (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
                            decoder.releaseOutputBuffer(slot, false)
                        }
                    }
                }
                val last = JSONObject(recognizer.finalResult).optString("text").trim()
                if (last.isNotEmpty()) phrases.add(last)
            }
            return phrases.joinToString(" ").trim()
        } finally {
            try { decoder?.stop() } catch (_: Exception) {}
            try { decoder?.release() } catch (_: Exception) {}
            try { extractor?.release() } catch (_: Exception) {}
            temp.delete()
        }
    }

    private fun toMono16k(bytes: ByteArray, inputRate: Int, channels: Int): ByteArray {
        if (inputRate <= 0 || channels <= 0) return byteArrayOf()
        val frames = bytes.size / (2 * channels)
        if (frames <= 0) return byteArrayOf()
        val outFrames = max(1, (frames * 16000L / inputRate).toInt())
        val output = ByteArray(outFrames * 2)
        for (i in 0 until outFrames) {
            val frame = min(frames - 1, (i.toLong() * inputRate / 16000L).toInt())
            var total = 0
            for (channel in 0 until channels) {
                val index = (frame * channels + channel) * 2
                val value = ((bytes[index].toInt() and 0xff) or (bytes[index + 1].toInt() shl 8)).toShort().toInt()
                total += value
            }
            val sample = (total / channels).toShort().toInt()
            output[i * 2] = (sample and 0xff).toByte()
            output[i * 2 + 1] = ((sample shr 8) and 0xff).toByte()
        }
        return output
    }

    fun shutdown() {
        closed = true
        stopMic()
        pendingNotes.clear()
        worker.shutdown()
        try { model?.close() } catch (_: Exception) {}
        model = null
    }
}
