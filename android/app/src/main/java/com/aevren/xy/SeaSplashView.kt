package com.aevren.xy

import android.content.Context
import android.graphics.*
import android.os.SystemClock
import android.view.View
import kotlin.math.sin

class SeaSplashView(context: Context) : View(context) {
    private val p = Paint(3)
    private val path = Path()
    private val start = SystemClock.uptimeMillis()
    override fun onDraw(c: Canvas) {
        val w=width.toFloat(); val h=height.toFloat()
        val s=w/390f; val x=w/2f
        p.shader=LinearGradient(0f,0f,0f,h,intArrayOf(0xffdfeae6.toInt(),0xffc9ddd6.toInt(),0xff8fb3aa.toInt(),0xff6f9a91.toInt()),floatArrayOf(0f,.45f,.68f,1f),Shader.TileMode.CLAMP)
        c.drawRect(0f,0f,w,h,p);p.shader=null
        p.color=0xfffff6dd.toInt();p.style=Paint.Style.FILL
        c.drawCircle(w*.72f,h*.30f,29*s,p)
        p.color=0xff30483e.toInt();path.reset()
        val y=h*.405f
        path.moveTo(x,y);path.lineTo(x+58*s,y+58*s);path.lineTo(x-58*s,y+58*s);path.close();c.drawPath(path,p)
        p.color=0xfff0ece3.toInt()
        c.drawRoundRect(x-43*s,y+44*s,x+43*s,y+102*s,3*s,3*s,p)
        p.color=0xff8c705b.toInt();c.drawRect(x-2*s,y+65*s,x+17*s,y+102*s,p)
        p.color=0xffeabd6e.toInt();c.drawRect(x+18*s,y+60*s,x+35*s,y+77*s,p)
        p.style=Paint.Style.STROKE;p.strokeWidth=2*s
        val drift=(sin((SystemClock.uptimeMillis()-start)/540.0)*4).toFloat()*s
        for(i in 0..2){
            p.color=Color.argb(175-i*37,241,248,245);path.reset()
            val v=h*.665f+i*25*s+drift
            path.moveTo(-w*.07f,v);path.cubicTo(w*.27f,v-25*s,w*.72f,v-25*s,w*1.07f,v)
            c.drawPath(path,p)
        }
        p.style=Paint.Style.FILL;p.color=0xff29443b.toInt()
        p.textSize=28*s;p.textAlign=Paint.Align.CENTER;p.typeface=Typeface.SERIF
        c.drawText("砚屿",x,h*.603f,p)
        p.color=0xff6f877b.toInt();p.textSize=12*s
        c.drawText("回家了",x,h*.634f,p)
        if(isAttachedToWindow)postInvalidateDelayed(50)
    }
}
