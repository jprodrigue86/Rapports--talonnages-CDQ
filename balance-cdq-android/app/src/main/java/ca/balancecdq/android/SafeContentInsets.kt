package ca.balancecdq.android

import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/** System bars, cutouts and the keyboard are measured by Android, never guessed from a phone model. */
internal object SafeContentInsets {
    fun padding(insets: WindowInsetsCompat): Insets {
        val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
        val gestures = insets.getInsets(WindowInsetsCompat.Type.mandatorySystemGestures())
        val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
        return Insets.of(bars.left, bars.top, bars.right, maxOf(bars.bottom, gestures.bottom, keyboard.bottom))
    }

    fun host(activity: Activity, content: View): FrameLayout {
        WindowCompat.setDecorFitsSystemWindows(activity.window, false)
        activity.window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        if (Build.VERSION.SDK_INT >= 28) {
            val attributes = activity.window.attributes
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            activity.window.attributes = attributes
        }
        val root = FrameLayout(activity).apply {
            setBackgroundColor(Color.BLACK)
            clipToPadding = true
            addView(content, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
        WindowCompat.getInsetsController(activity.window, root).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val p = padding(insets)
            // Absolute padding: repeated dispatch/rotation must not accumulate it.
            if (view.paddingLeft != p.left || view.paddingTop != p.top || view.paddingRight != p.right || view.paddingBottom != p.bottom) {
                view.setPadding(p.left, p.top, p.right, p.bottom)
            }
            // The entire WebView, including fixed footers/dialogs, is inside the safe rectangle.
            // WebView must not apply the same system/IME inset a second time.
            WindowInsetsCompat.CONSUMED
        }
        root.addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) { ViewCompat.requestApplyInsets(v) }
            override fun onViewDetachedFromWindow(v: View) = Unit
        })
        return root
    }
}
