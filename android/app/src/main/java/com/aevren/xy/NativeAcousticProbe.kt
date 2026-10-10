package com.aevren.xy

import kotlin.math.abs
import kotlin.math.sqrt

/**
 * Reads only audio features exposed by Android SpeechRecognizer callbacks.
 * Does not open a second microphone or claim to recognize bodily events.
 */
internal class NativeAcousticProbe(private val report: (String) -> Unit) {
    private var consecutiveLoud = 0
    private var rmsSamples = 0
    private var rmsActive = 0
    private var burstCount = 0
    private var pcmWindows = 0
    private var pcmActive = 0
    private var pcmNoisy = 0
    private var lastReport = 0L
    private var emitted = 0

    fun onRms(db: Float) {
        if (!db.isFinite()) return
        rmsSamples++
        if (db > 5f) {
            rmsActive++
            consecutiveLoud++
            if (consecutiveLoud == 2) burstCount++
        } else consecutiveLoud = 0
        if (rmsSamples >= 36) {
            if (burstCount >= 3 && burstCount <= 11) emit("原生麦克风检测到几次短促音量变化（声音来源未确认）")
            resetRms()
        }
    }

    fun onBuffer(data: ByteArray?) {
        if (data == null || data.size < 256 || data.size % 2 != 0) return
        // SpeechRecognizer.onBufferReceived is optional; PCM 16-bit assumed only
        // when the framework service supplies it, no sampling-rate inference.
        var total = 0.0
        var crossings = 0
        var prev = 0
        val count = data.size / 2
        for (i in 0 until count) {
            val lo = data[2 * i].toInt() and 0xff
            val hi = data[2 * i + 1].toInt()
            val sample = (lo or (hi shl 8)).toShort().toInt()
            total += sample.toDouble() * sample
            if (i > 0 && (sample >= 0) != (prev >= 0)) crossings++
            prev = sample
        }
        val rms = sqrt(total / count) / 32768.0
        if (rms < 0.025) return
        pcmWindows++
        pcmActive++
        if (crossings.toDouble() / count > 0.17) pcmNoisy++
        if (pcmWindows >= 18) {
            if (pcmActive >= 8 && pcmNoisy >= 10) emit("原生语音缓冲中检测到持续高频噪声（不能确定是呼吸或环境音）")
            pcmWindows = 0
            pcmActive = 0
            pcmNoisy = 0
        }
    }

    private fun emit(label: String) {
        val now = System.currentTimeMillis()
        if (emitted >= 2 || now - lastReport < 4500) return
        emitted++
        lastReport = now
        report(label)
    }

    fun reset() {
        resetRms()
        pcmWindows = 0
        pcmActive = 0
        pcmNoisy = 0
        emitted = 0
        lastReport = 0
    }
    private fun resetRms() {
        rmsSamples = 0
        rmsActive = 0
        burstCount = 0
        consecutiveLoud = 0
    }
}