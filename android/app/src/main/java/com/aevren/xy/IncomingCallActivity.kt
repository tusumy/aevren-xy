package com.aevren.xy

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.roundToInt

/**
 * Native incoming-call screen, styled to match the pearl-glass startup
 * and the web call interface. Intent actions remain unchanged.
 */
class IncomingCallActivity : Activity() {
    private var characterId: String = ""
    private var characterName: String = "AI"
    private val ink = Color.rgb(58, 85, 68)
    private val muted = Color.rgb(113, 143, 120)
    private val green = Color.rgb(81, 128, 95)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        characterId = intent.getStringExtra(NativeCallManager.EXTRA_CHARACTER_ID).orEmpty()
        characterName = intent.getStringExtra(NativeCallManager.EXTRA_CHARACTER_NAME).orEmpty().ifBlank { "AI" }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.statusBarColor = Color.rgb(247, 252, 248)
        window.navigationBarColor = Color.rgb(236, 241, 234)

        handleAction(intent.action)
        if (!isFinishing) setContentView(buildUi())
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        characterId = intent.getStringExtra(NativeCallManager.EXTRA_CHARACTER_ID).orEmpty()
        characterName = intent.getStringExtra(NativeCallManager.EXTRA_CHARACTER_NAME).orEmpty().ifBlank { "AI" }
        handleAction(intent.action)
    }

    private fun handleAction(action: String?) {
        when (action) {
            NativeCallManager.ACTION_ANSWER -> answer()
            NativeCallManager.ACTION_DECLINE -> decline()
        }
    }

    private fun answer() {
        NativeCallManager.dismiss(this)
        val open = Intent(this, MainActivity::class.java).apply {
            action = MainActivity.ACTION_NATIVE_CALL_ANSWER
            putExtra(NativeCallManager.EXTRA_CHARACTER_ID, characterId)
            putExtra(NativeCallManager.EXTRA_CHARACTER_NAME, characterName)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        startActivity(open)
        finish()
    }

    private fun decline() {
        NativeCallManager.dismiss(this)
        finish()
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).roundToInt()

    private fun circle(fill: Int, border: Int = Color.TRANSPARENT, width: Int = 0): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(fill)
            if (width > 0) setStroke(dp(width), border)
        }

    private fun callButton(label: String, background: Int, declined: Boolean): LinearLayout {
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            isClickable = true
            isFocusable = true
            contentDescription = label
        }

        val button = FrameLayout(this).apply {
            background = circle(background, Color.argb(70, 255, 255, 255), 1)
            elevation = dp(7).toFloat()
            isClickable = true
            isFocusable = true
            contentDescription = label
        }
        val icon = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_call)
            setColorFilter(Color.WHITE)
            rotation = if (declined) 135f else 0f
            contentDescription = null
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        button.addView(
            icon,
            FrameLayout.LayoutParams(dp(29), dp(29), Gravity.CENTER)
        )
        column.addView(button, LinearLayout.LayoutParams(dp(69), dp(69)))

        val caption = TextView(this).apply {
            text = label
            textSize = 12f
            gravity = Gravity.CENTER
            setTextColor(ink)
            setPadding(0, dp(12), 0, 0)
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        }
        column.addView(caption)

        button.setOnClickListener { if (declined) decline() else answer() }
        column.setOnClickListener { if (declined) decline() else answer() }
        return column
    }

    private fun buildUi(): FrameLayout {
        val root = FrameLayout(this)
        root.addView(
            PearlCallBackdrop(this),
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(48), dp(24), dp(24))
        }
        root.addView(
            body,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        val brand = TextView(this).apply {
            text = "A E V R E N   X Y   ·   V O I C E"
            textSize = 10f
            setTextColor(green)
            gravity = Gravity.CENTER
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            letterSpacing = .08f
        }
        body.addView(
            brand,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(27)
            )
        )

        body.addView(View(this), LinearLayout.LayoutParams(1, 0, .8f))

        // Concentric outlines sit behind the user's existing round avatar.
        val avatarOrbit = FrameLayout(this)
        val outerRing = View(this).apply {
            background = circle(Color.TRANSPARENT, Color.argb(92, 255, 255, 255), 1)
        }
        avatarOrbit.addView(
            outerRing,
            FrameLayout.LayoutParams(dp(192), dp(192), Gravity.CENTER)
        )
        val innerRing = View(this).apply {
            background = circle(Color.TRANSPARENT, Color.argb(70, 97, 147, 113), 1)
        }
        avatarOrbit.addView(
            innerRing,
            FrameLayout.LayoutParams(dp(158), dp(158), Gravity.CENTER)
        )

        val halo = View(this).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.rgb(253, 255, 251), Color.rgb(214, 234, 212))
            ).apply {
                shape = GradientDrawable.OVAL
                setStroke(dp(2), Color.argb(222, 255, 255, 255))
            }
            elevation = dp(6).toFloat()
        }
        avatarOrbit.addView(
            halo,
            FrameLayout.LayoutParams(dp(128), dp(128), Gravity.CENTER)
        )

        val bitmap = NativeCallManager.loadAvatar(this, characterId)
        val avatar = if (bitmap != null) {
            ImageView(this).apply {
                setImageBitmap(bitmap)
                scaleType = ImageView.ScaleType.CENTER_CROP
                background = circle(Color.rgb(225, 237, 222))
                clipToOutline = true
                contentDescription = characterName + "的头像"
            }
        } else {
            TextView(this).apply {
                text = characterName.take(1)
                textSize = 46f
                typeface = Typeface.create("serif", Typeface.NORMAL)
                gravity = Gravity.CENTER
                setTextColor(ink)
                contentDescription = characterName + "的头像"
            }
        }
        avatarOrbit.addView(
            avatar,
            FrameLayout.LayoutParams(dp(122), dp(122), Gravity.CENTER)
        )
        body.addView(avatarOrbit, LinearLayout.LayoutParams(dp(208), dp(208)))

        val name = TextView(this).apply {
            text = characterName
            textSize = 30f
            typeface = Typeface.create("serif", Typeface.NORMAL)
            gravity = Gravity.CENTER
            setTextColor(ink)
            maxLines = 2
            setPadding(0, dp(13), 0, 0)
        }
        body.addView(
            name,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        val status = TextView(this).apply {
            text = "语音来电 · 等待接听"
            textSize = 13f
            gravity = Gravity.CENTER
            setTextColor(muted)
            setPadding(0, dp(10), 0, 0)
        }
        body.addView(
            status,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        body.addView(View(this), LinearLayout.LayoutParams(1, 0, 1.25f))

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        actions.addView(
            callButton("拒绝", Color.rgb(201, 106, 113), true),
            LinearLayout.LayoutParams(dp(101), LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                marginEnd = dp(29)
            }
        )
        actions.addView(
            callButton("接听", Color.rgb(84, 142, 101), false),
            LinearLayout.LayoutParams(dp(101), LinearLayout.LayoutParams.WRAP_CONTENT)
        )
        body.addView(
            actions,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        val footer = TextView(this).apply {
            text = "ONLY OURS  ·  只属于我们的声音"
            gravity = Gravity.CENTER
            textSize = 10f
            letterSpacing = .06f
            setTextColor(muted)
            setPadding(0, dp(22), 0, dp(5))
        }
        body.addView(
            footer,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )
        return root
    }
}

/** Native counterpart of the web call screen's four-corner pearl lighting. */
private class PearlCallBackdrop(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        paint.style = Paint.Style.FILL
        paint.shader = LinearGradient(
            0f, 0f, w * .35f, h,
            intArrayOf(
                Color.rgb(249, 252, 248),
                Color.rgb(235, 246, 232),
                Color.rgb(217, 234, 218),
                Color.rgb(244, 230, 234)
            ),
            floatArrayOf(0f, .35f, .74f, 1f),
            Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, w, h, paint)
        paint.shader = null

        glow(canvas, w * .12f, h * .07f, w * .83f, Color.argb(205, 255, 255, 255))
        glow(canvas, w * .91f, h * .38f, w * .69f, Color.argb(95, 247, 205, 225))
        glow(canvas, w * .04f, h * .79f, w * .82f, Color.argb(105, 164, 205, 153))
        glow(canvas, w * .81f, h * .95f, w * .57f, Color.argb(72, 255, 252, 247))
    }

    private fun glow(canvas: Canvas, x: Float, y: Float, radius: Float, color: Int) {
        paint.shader = RadialGradient(
            x, y, radius, intArrayOf(color, Color.TRANSPARENT),
            null, Shader.TileMode.CLAMP
        )
        canvas.drawCircle(x, y, radius, paint)
        paint.shader = null
    }
}
