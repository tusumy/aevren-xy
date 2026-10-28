package com.aevren.xy

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.view.View
import kotlin.math.min

/**
 * 砚屿 · Pearl Aura startup screen.
 *
 * An understated apple-green / rose-pearl glass mark. No flowers, decorative
 * frames, portraits, islands or artwork that would compete with the home UI.
 * MainActivity owns the ready-state check and removes this view when painted.
 */
class SeaSplashView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        val scale = min(w / 390f, h / 780f)
        val cx = w * .5f
        val cy = h * .45f
        val radius = 99f * scale

        // Full-bleed pearlescent background: cool white -> apple mist -> blush.
        paint.style = Paint.Style.FILL
        paint.shader = LinearGradient(
            0f, 0f, w * .28f, h,
            intArrayOf(
                Color.rgb(249, 252, 247),
                Color.rgb(238, 247, 234),
                Color.rgb(219, 234, 219),
                Color.rgb(243, 229, 232)
            ),
            floatArrayOf(0f, .37f, .72f, 1f),
            Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, w, h, paint)
        paint.shader = null

        glow(canvas, w * .10f, h * .12f, w * .77f, Color.argb(205, 255, 255, 255))
        glow(canvas, w * .96f, h * .31f, w * .67f, Color.argb(116, 246, 211, 219))
        glow(canvas, w * .07f, h * .76f, w * .72f, Color.argb(113, 174, 207, 159))
        glow(canvas, w * .76f, h * .94f, w * .56f, Color.argb(95, 253, 244, 237))

        // Two thin, spacious light orbits establish depth without floral motifs.
        strokeOval(
            canvas, cx, cy, radius * 1.34f, radius * 1.23f,
            Color.argb(81, 104, 151, 113), 1.05f * scale
        )
        strokeOval(
            canvas, cx, cy, radius * 1.53f, radius * 1.39f,
            Color.argb(74, 255, 255, 255), 1.45f * scale
        )

        // Soft shadow and a translucent, dimensional glass disc.
        glow(canvas, cx, cy + radius * .27f, radius * 1.48f, Color.argb(80, 94, 147, 106))
        paint.style = Paint.Style.FILL
        paint.shader = RadialGradient(
            cx - radius * .32f, cy - radius * .52f, radius * 2.12f,
            intArrayOf(
                Color.argb(239, 255, 255, 255),
                Color.argb(220, 246, 255, 244),
                Color.argb(226, 222, 237, 220),
                Color.argb(204, 220, 229, 215)
            ),
            floatArrayOf(0f, .29f, .66f, 1f),
            Shader.TileMode.CLAMP
        )
        canvas.drawCircle(cx, cy, radius, paint)
        paint.shader = null

        // Fine silver-white rim; slight colored inner rim and upper specular arc.
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 1.6f * scale
        paint.shader = LinearGradient(
            cx - radius, cy - radius, cx + radius, cy + radius,
            intArrayOf(Color.WHITE, Color.argb(219, 248, 255, 250), Color.argb(155, 104, 148, 115)),
            null, Shader.TileMode.CLAMP
        )
        canvas.drawCircle(cx, cy, radius - paint.strokeWidth / 2f, paint)
        paint.shader = null
        paint.color = Color.argb(100, 255, 255, 255)
        paint.strokeWidth = .9f * scale
        canvas.drawCircle(cx, cy, radius - 5.2f * scale, paint)

        paint.color = Color.argb(195, 255, 255, 255)
        paint.strokeWidth = 3.0f * scale
        paint.strokeCap = Paint.Cap.ROUND
        canvas.drawArc(
            RectF(cx - radius + 9f * scale, cy - radius + 9f * scale,
                  cx + radius - 9f * scale, cy + radius - 9f * scale),
            207f, 93f, false, paint
        )
        paint.style = Paint.Style.FILL

        // A restrained iridescent sweep behind the title. It reads as light,
        // not a flower or a logo from another app.
        val sweep = Path().apply {
            moveTo(cx - 61f * scale, cy + 34f * scale)
            cubicTo(
                cx - 24f * scale, cy + 20f * scale,
                cx + 20f * scale, cy + 50f * scale,
                cx + 62f * scale, cy + 27f * scale
            )
        }
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 2.2f * scale
        paint.color = Color.argb(103, 178, 139, 154)
        canvas.drawPath(sweep, paint)
        paint.style = Paint.Style.FILL

        // Brand typography is part of the orb, not a thick white banner.
        paint.textAlign = Paint.Align.CENTER
        paint.typeface = Typeface.create("serif", Typeface.NORMAL)
        paint.textSize = 47f * scale
        paint.color = Color.rgb(66, 97, 76)
        canvas.drawText("砚屿", cx, cy + 13f * scale, paint)

        paint.typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        paint.textSize = 9.3f * scale
        paint.color = Color.argb(220, 102, 139, 108)
        canvas.drawText("A E V R E N   ·   X Y", cx, cy + radius + 46f * scale, paint)

        // Minimal pearl glints: no flower clusters and no repeating border.
        smallStar(canvas, cx + radius * 1.30f, cy - radius * .83f, 8.5f * scale)
        smallStar(canvas, cx - radius * 1.29f, cy + radius * .54f, 5.0f * scale)
        paint.color = Color.argb(145, 255, 255, 255)
        canvas.drawCircle(cx + radius * 1.38f, cy - radius * .48f, 2.3f * scale, paint)
    }

    private fun strokeOval(
        canvas: Canvas, cx: Float, cy: Float,
        rx: Float, ry: Float, color: Int, width: Float
    ) {
        paint.shader = null
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = width
        paint.color = color
        canvas.drawOval(RectF(cx - rx, cy - ry, cx + rx, cy + ry), paint)
        paint.style = Paint.Style.FILL
    }

    private fun glow(canvas: Canvas, x: Float, y: Float, radius: Float, color: Int) {
        paint.style = Paint.Style.FILL
        paint.shader = RadialGradient(
            x, y, radius, intArrayOf(color, Color.TRANSPARENT),
            null, Shader.TileMode.CLAMP
        )
        canvas.drawCircle(x, y, radius, paint)
        paint.shader = null
    }

    private fun smallStar(canvas: Canvas, x: Float, y: Float, radius: Float) {
        val shape = Path().apply {
            moveTo(x, y - radius)
            quadTo(x + radius * .13f, y - radius * .13f, x + radius, y)
            quadTo(x + radius * .13f, y + radius * .13f, x, y + radius)
            quadTo(x - radius * .13f, y + radius * .13f, x - radius, y)
            quadTo(x - radius * .13f, y - radius * .13f, x, y - radius)
            close()
        }
        paint.shader = null
        paint.style = Paint.Style.FILL
        paint.color = Color.argb(184, 255, 255, 255)
        canvas.drawPath(shape, paint)
    }
}
