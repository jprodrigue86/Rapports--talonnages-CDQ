package ca.balancecdq.android

import android.app.Activity
import android.view.View
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28, 35])
class SafeContentInsetsTest {
    private fun insets(top: Int, bottom: Int, left: Int = 0, right: Int = 0, ime: Int = 0): WindowInsetsCompat =
        WindowInsetsCompat.Builder()
            .setInsets(WindowInsetsCompat.Type.statusBars(), Insets.of(0, top, 0, 0))
            .setInsets(WindowInsetsCompat.Type.navigationBars(), Insets.of(left, 0, right, bottom))
            .setInsets(WindowInsetsCompat.Type.ime(), Insets.of(0, 0, 0, ime))
            .build()

    @Test fun systemNavigationAndKeyboardUseTheirActualSizes() {
        assertEquals(Insets.of(0, 32, 0, 24), SafeContentInsets.padding(insets(32,24)))
        assertEquals(Insets.of(0, 32, 0, 48), SafeContentInsets.padding(insets(32,48)))
        assertEquals(Insets.of(0, 32, 0, 340), SafeContentInsets.padding(insets(32,48,ime=340)))
        assertEquals(Insets.of(0, 32, 0, 48), SafeContentInsets.padding(insets(32,48)))
    }

    @Test fun contentRemainsInsideSafeRectangleWithoutDoublePadding() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val content = View(activity)
        val root = SafeContentInsets.host(activity, content)
        activity.setContentView(root)
        fun check(width: Int, height: Int, supplied: WindowInsetsCompat, expected: Insets) {
            val consumed = ViewCompat.dispatchApplyWindowInsets(root,supplied)
            assertTrue(consumed.isConsumed)
            root.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY))
            root.layout(0,0,width,height)
            assertEquals(expected.left,content.left)
            assertEquals(expected.top,content.top)
            assertEquals(width-expected.right,content.right)
            assertEquals(height-expected.bottom,content.bottom)
        }
        for (n in 1..3) check(412,915,insets(32,48),Insets.of(0,32,0,48))
        check(412,915,insets(32,24),Insets.of(0,32,0,24))
        check(915,412,insets(24,0,left=40,right=48),Insets.of(40,24,48,0))
        check(412,915,insets(32,48,ime=340),Insets.of(0,32,0,340))
        check(412,915,insets(32,48),Insets.of(0,32,0,48))
    }
}
