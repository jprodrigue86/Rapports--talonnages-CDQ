package ca.balancecdq.android

import android.content.Intent
import android.net.Uri
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class DocumentIntentsTest {
    private val uri = Uri.parse("content://ca.balancecdq.android.updatefiles/pdf_cache/report.pdf")

    @Test fun `Acrobat view receives PDF content URI and edit permission`() {
        val first = DocumentIntents.candidates(uri, "application/pdf", false, "com.adobe.reader").first()
        assertEquals(Intent.ACTION_VIEW, first.action)
        assertEquals("com.adobe.reader", first.`package`)
        assertEquals(uri, first.data)
        assertEquals("application/pdf", first.type)
        assertEquals(uri, first.clipData!!.getItemAt(0).uri)
        assertTrue(first.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0)
        assertTrue(first.flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION != 0)
    }

    @Test fun `share-only readers receive a readable stream without incompatible data URI`() {
        val candidates = DocumentIntents.candidates(uri, "application/pdf", false, "com.ilovepdf.www")
        val send = candidates.first { it.action == Intent.ACTION_SEND }
        assertNull(send.data)
        assertEquals(uri, send.getParcelableExtra<Uri>(Intent.EXTRA_STREAM))
        assertEquals(uri, send.clipData!!.getItemAt(0).uri)
        assertEquals("application/pdf", send.type)
        assertTrue(DocumentIntents.importsCopy(send))
        assertEquals(0, send.flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        val multiple = candidates.first { it.action == Intent.ACTION_SEND_MULTIPLE }
        assertEquals(listOf(uri), multiple.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM))
    }

    @Test fun `read-only documents never grant write permission or offer EDIT`() {
        val candidates = DocumentIntents.candidates(uri, "application/pdf", true)
        assertFalse(candidates.any { it.action == Intent.ACTION_EDIT })
        assertTrue(candidates.all { it.flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION == 0 })
        assertTrue(candidates.all { it.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0 })
    }
}
