package com.aevren.xy

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import kotlin.math.max

/**
 * The native startup curtain matches the online island illustration.
 * No separate "only words" screen, cottage, or extra animation.
 */
class SeaSplashView(context: Context) : View(context) {
    private val bitmap = BitmapFactory.decodeResource(resources, R.drawable.island_splash)
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        canvas.drawColor(Color.rgb(232, 215, 218))
        if (w <= 0f || h <= 0f || bitmap == null) return
        val scale = max(w / bitmap.width, h / bitmap.height)
        val drawnWidth = bitmap.width * scale
        val drawnHeight = bitmap.height * scale
        val dest = RectF(
            (w - drawnWidth) / 2f,
            (h - drawnHeight) / 2f,
            (w + drawnWidth) / 2f,
            (h + drawnHeight) / 2f
        )
        canvas.drawBitmap(bitmap, null, dest, paint)
    }
}
