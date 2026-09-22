package ca.balancecdq.android

import android.app.Activity
import android.content.Intent
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowAlertDialog

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class DocumentAuthorizationTest {
    private fun verifyMissingAuthorization(resultCode: Int) {
        // An empty request opens validation feedback without contacting Google.
        val controller = Robolectric.buildActivity(DriveDocumentActivity::class.java).create().start().resume()
        val activity = controller.get()
        ShadowAlertDialog.getLatestAlertDialog().dismiss()
        DriveDocumentActivity::class.java.getDeclaredMethod("onActivityResult",
            Int::class.javaPrimitiveType, Int::class.javaPrimitiveType, Intent::class.java).apply {
            isAccessible = true
        }.invoke(activity, 25002, resultCode, null)
        assertFalse("Google's closed window must not silently finish the document activity", activity.isFinishing)
        val error = ShadowAlertDialog.getLatestAlertDialog()
        assertTrue(error.isShowing)
        assertTrue(shadowOf(error).message.toString().contains("Aucun PDF n’a été envoyé"))
        assertNull(shadowOf(activity).nextStartedActivity)
        error.dismiss()
        controller.pause().stop().destroy()
    }

    @Test fun `cancelled Google authorization stays visible as actionable failure`() {
        verifyMissingAuthorization(Activity.RESULT_CANCELED)
    }

    @Test fun `empty Google success response cannot silently close the document`() {
        verifyMissingAuthorization(Activity.RESULT_OK)
    }
}
