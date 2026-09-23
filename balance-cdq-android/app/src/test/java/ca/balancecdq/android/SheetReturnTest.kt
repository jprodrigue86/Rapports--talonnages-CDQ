package ca.balancecdq.android

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class SheetReturnTest {
    private fun request() = Intent(Intent.ACTION_VIEW, Uri.parse(
        "cdqsheet://open?fileId=sheet_test_123456&account=tech%40example.invalid&accountMode=default"))

    @Test fun `browser editor keeps CDQ parent and returns a result without separate task`() {
        val controller = Robolectric.buildActivity(SheetOpenActivity::class.java, request()).create().start().resume()
        val activity = controller.get()
        val launch = shadowOf(activity).nextStartedActivityForResult
        assertNotNull(launch)
        assertEquals(25260, launch.requestCode)
        assertEquals("docs.google.com", launch.intent.data!!.host)
        assertEquals("tech@example.invalid", launch.intent.data!!.getQueryParameter("authuser"))
        assertEquals(0, launch.intent.flags and (Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP))
        assertFalse(activity.isFinishing)
        shadowOf(activity).receiveResult(launch.intent, android.app.Activity.RESULT_CANCELED, null)
        assertTrue(activity.isFinishing)
        controller.pause().stop().destroy()
    }

    @Test fun `recreating the handoff while Sheets is open never launches a second editor`() {
        val controller = Robolectric.buildActivity(SheetOpenActivity::class.java, request()).create().start().resume()
        val state = Bundle()
        controller.saveInstanceState(state).pause().stop().destroy()
        assertTrue(state.getBoolean("sheetLaunched"))
        val restored = Robolectric.buildActivity(SheetOpenActivity::class.java, request()).create(state).start().resume()
        assertNull(shadowOf(restored.get()).nextStartedActivity)
        assertFalse(restored.get().isFinishing)
        restored.pause().stop().destroy()
    }
}
