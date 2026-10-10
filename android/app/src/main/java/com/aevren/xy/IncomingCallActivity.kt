package com.aevren.xy

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.roundToInt

class IncomingCallActivity : Activity() {
    private var characterId: String = ""
    private var characterName: String = "AI"

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
        window.statusBarColor = Color.rgb(220, 233, 227)
        window.navigationBarColor = Color.rgb(220, 233, 227)

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

    private fun buildUi(): FrameLayout {
        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(220, 233, 227))
        }

        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(28), dp(72), dp(28), dp(32))
        }

        val image = NativeCallManager.loadAvatar(this, characterId)
        val avatar = if (image != null) {
            ImageView(this).apply {
                setImageBitmap(image)
                scaleType = ImageView.ScaleType.CENTER_CROP
                contentDescription = characterName + "的头像"
            }
        } else {
            TextView(this).apply {
                text = characterName.take(1)
                textSize = 38f
                gravity = Gravity.CENTER
                setTextColor(Color.WHITE)
                setBackgroundColor(Color.rgb(53, 93, 74))
            }
        }
        body.addView(
            avatar,
            LinearLayout.LayoutParams(dp(112), dp(112)).apply {
                bottomMargin = dp(24)
            }
        )

        val name = TextView(this).apply {
            text = characterName
            textSize = 28f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(42, 57, 49))
        }
        body.addView(
            name,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        val status = TextView(this).apply {
            text = "语音来电"
            textSize = 14f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(111, 126, 117))
            setPadding(0, dp(10), 0, 0)
        }
        body.addView(
            status,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        val spacer = TextView(this)
        body.addView(
            spacer,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }

        val decline = Button(this).apply {
            text = "拒绝"
            isAllCaps = false
            setOnClickListener { decline() }
        }
        val answer = Button(this).apply {
            text = "接听"
            isAllCaps = false
            setOnClickListener { answer() }
        }

        actions.addView(
            decline,
            LinearLayout.LayoutParams(dp(116), dp(54)).apply {
                marginEnd = dp(24)
            }
        )
        actions.addView(
            answer,
            LinearLayout.LayoutParams(dp(116), dp(54))
        )

        body.addView(actions)

        root.addView(
            body,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )
        return root
    }
}
