package com.aevren.xy

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import android.view.View

/**
 * Minimal native loading curtain; the animated island is rendered by the online WebView.
 * Deliberately contains no old cottage/house art or artificial wave animation.
 */
class SeaSplashView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        paint.style = Paint.Style.FILL
        paint.shader = LinearGradient(
            0f, 0f, 0f, h,
            intArrayOf(
                Color.rgb(246, 229, 233),
                Color.rgb(238, 231, 227),
                Color.rgb(208, 228, 218)
            ),
            floatArrayOf(0f, .54f, 1f),
            Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, w, h, paint)
        paint.shader = null

        // The native curtain remains visually quiet while WebView prepares the island.
        val density = w / 390f
        paint.color = Color.rgb(108, 82, 79)
        paint.textAlign = Paint.Align.CENTER
        paint.typeface = Typeface.create("serif", Typeface.NORMAL)
        paint.textSize = 35f * density
        canvas.drawText("砚屿", w / 2f, h * .49f, paint)

        paint.typeface = Typeface.create("sans-serif", Typeface.NORMAL)
        paint.textSize = 12f * density
        paint.color = Color.rgb(143, 118, 116)
        canvas.drawText("云海尽头，欢迎归岛", w / 2f, h * .53f, paint)
    }
}
