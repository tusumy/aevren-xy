package com.aevren.xy

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.view.View
import kotlin.math.min

/**
 * Neutral pearl-and-apple botanical startup curtain.
 * Draws no characters, portraits or old island artwork.
 * Fades only after the actual interactive homepage is ready.
 */
class SeaSplashView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val blossomCream = Color.rgb(255, 252, 244)
    private val blossomPink = Color.rgb(245, 207, 218)
    private val leafGreen = Color.rgb(143, 169, 128)

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        paint.shader = LinearGradient(
            0f, 0f, w, h,
            intArrayOf(Color.rgb(251, 250, 238), Color.rgb(227, 239, 216), Color.rgb(242, 229, 229)),
            null, Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, w, h, paint)
        paint.shader = null

        glow(canvas, w * .33f, h * .14f, w * .68f, Color.argb(176, 255, 255, 249))
        glow(canvas, w * .89f, h * .66f, w * .52f, Color.argb(82, 245, 204, 218))
        glow(canvas, w * .07f, h * .79f, w * .59f, Color.argb(105, 183, 214, 161))

        val s = min(w / 390f, h / 760f)
        for (i in 0..10) {
            val yy = h * ((i + .5f) / 11f)
            val leftX = w * (if (i % 2 == 0) .09f else .03f)
            val rightX = w * (if (i % 2 == 0) .91f else .98f)
            val scale = s * (if (i % 3 == 0) 1.08f else .74f)
            drawFlower(canvas, leftX, yy, scale, i % 3 == 0)
            drawFlower(canvas, rightX, yy + h * .026f, scale, i % 4 == 0)
        }
        paint.style = Paint.Style.FILL
        paint.color = Color.argb(196, 255, 255, 248)
        val box = RectF(w * .13f, h * .395f, w * .87f, h * .565f)
        canvas.drawRoundRect(box, 38f * s, 38f * s, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 2f * s
        paint.color = Color.argb(222, 255, 255, 255)
        canvas.drawRoundRect(box, 38f * s, 38f * s, paint)
        paint.style = Paint.Style.FILL

        paint.color = Color.rgb(62, 82, 54)
        paint.typeface = Typeface.create("serif", Typeface.BOLD)
        paint.textAlign = Paint.Align.CENTER
        paint.textSize = 45f * s
        canvas.drawText("砚屿", w / 2f, h * .481f, paint)

        paint.typeface = Typeface.create("serif", Typeface.NORMAL)
        paint.textSize = 13f * s
        paint.color = Color.rgb(117, 144, 105)
        canvas.drawText("O N L Y   O U R S", w / 2f, h * .515f, paint)

        paint.color = Color.rgb(224, 166, 183)
        paint.textSize = 25f * s
        canvas.drawText("♡", w / 2f, h * .556f, paint)
    }


    private fun glow(canvas: Canvas, x: Float, y: Float, radius: Float, color: Int) {
        paint.shader = RadialGradient(
            x, y, radius, intArrayOf(color, Color.TRANSPARENT),
            null, Shader.TileMode.CLAMP
        )
        canvas.drawCircle(x, y, radius, paint)
        paint.shader = null
    }

    private fun drawFlower(canvas: Canvas, x: Float, y: Float, scale: Float, pink: Boolean) {
        canvas.save()
        canvas.translate(x, y)
        canvas.scale(scale, scale)
        paint.shader = null
        paint.style = Paint.Style.FILL
        paint.color = Color.argb(150, 116, 151, 108)
        canvas.save()
        canvas.rotate(35f)
        canvas.drawOval(RectF(-13f, 15f, 15f, 58f), paint)
        canvas.restore()
        canvas.save()
        canvas.rotate(-46f)
        canvas.drawOval(RectF(-13f, 10f, 13f, 51f), paint)
        canvas.restore()
        paint.color = if (pink) blossomPink else blossomCream
        for (petal in 0..4) {
            canvas.save()
            canvas.rotate(petal * 72f)
            canvas.drawOval(RectF(-14f, -40f, 14f, -4f), paint)
            canvas.restore()
        }
        paint.color = Color.rgb(235, 209, 164)
        canvas.drawCircle(0f, 0f, 8f, paint)
        paint.color = leafGreen
        canvas.drawCircle(0f, 0f, 2.2f, paint)
        canvas.restore()
    }
}