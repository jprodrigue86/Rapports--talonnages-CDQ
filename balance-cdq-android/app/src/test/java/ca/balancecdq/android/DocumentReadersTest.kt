package ca.balancecdq.android

import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import java.io.File
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], qualifiers = "w360dp-h800dp-mdpi")
class DocumentReadersTest {
    private fun resolve(pkg: String, appLabel: String, activityLabel: String) = ResolveInfo().apply {
        nonLocalizedLabel = activityLabel
        activityInfo = ActivityInfo().apply {
            packageName = pkg
            name = "$pkg.OpenActivity"
            applicationInfo = ApplicationInfo().apply {
                packageName = pkg
                nonLocalizedLabel = appLabel
            }
        }
    }

    @Test fun `iLovePDF is named as an application instead of Run Tool`() {
        val context = RuntimeEnvironment.getApplication()
        val info = resolve(DocumentReaders.ILOVEPDF, "iLovePDF", "Exécuter l’outil")
        assertEquals("iLovePDF", DocumentReaders.label(context.packageManager, info))
        assertEquals("Application de lecture", DocumentReaders.label(context.packageManager,
            resolve("test.reader", "Application de lecture", "Fonction interne")))
    }

    @Test fun `import-only iLovePDF appears once alongside Acrobat and generic share targets stay excluded`() {
        val context = RuntimeEnvironment.getApplication()
        val pm = shadowOf(context.packageManager)
        val uri = Uri.parse("content://${context.packageName}.updatefiles/probe/document.pdf")
        for (candidate in DocumentIntents.candidates(uri, "application/pdf", false)) {
            val infos = if (DocumentIntents.importsCopy(candidate)) listOf(
                resolve(DocumentReaders.ILOVEPDF, "iLovePDF", "Exécuter l’outil"),
                resolve("test.mail", "Courriel", "Partager")
            ) else listOf(resolve(DocumentReaders.ACROBAT, "Adobe Acrobat", "Modifier"))
            pm.setResolveInfosForIntent(candidate, infos)
        }
        val readers = DocumentReaders.available(context, "application/pdf", false)
        assertEquals(listOf("iLovePDF", "Adobe Acrobat"), readers.map { it.label })
        assertTrue(readers[0].importOnly)
        assertFalse(readers[1].importOnly)
    }

    @Test fun `tap selects reader once without triggering cancel`() {
        val controller = Robolectric.buildActivity(Activity::class.java).setup()
        val activity = controller.get()
        val reader = DocumentReader("iLovePDF", DocumentReaders.ILOVEPDF)
        var selected = 0
        var cancelled = 0
        val dialog = DocumentReaderDialog.show(activity, "Rapport.pdf", listOf(reader), false,
            { assertEquals(reader, it); selected++ }, { cancelled++ })
        val row = dialog.window!!.decorView.findViewWithTag<View>(reader.packageName)
        row.performClick()
        row.performClick()
        assertEquals(1, selected)
        assertEquals(0, cancelled)
        assertFalse(dialog.isShowing)
        controller.pause().stop().destroy()
    }

    @Test fun `cancel leaves document unopened`() {
        val controller = Robolectric.buildActivity(Activity::class.java).setup()
        var selected = false
        var cancelled = false
        val dialog = DocumentReaderDialog.show(controller.get(), "Rapport.pdf", emptyList(), false,
            { selected = true }, { cancelled = true })
        dialog.cancel()
        shadowOf(android.os.Looper.getMainLooper()).idle()
        assertFalse(selected)
        assertTrue(cancelled)
        controller.pause().stop().destroy()
    }

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun `reader sheet renders with branded names and a scrollable list`() {
        val controller = Robolectric.buildActivity(Activity::class.java).setup()
        val activity = controller.get()
        val dialog = DocumentReaderDialog.show(activity, "Rapport d’étalonnage.pdf", listOf(
            DocumentReader("iLovePDF", DocumentReaders.ILOVEPDF),
            DocumentReader("Adobe Acrobat", DocumentReaders.ACROBAT),
            DocumentReader("Lecteur PDF", "test.reader"),
            DocumentReader("Visionneuse PDF", "test.viewer")
        ), false, {}, {})
        val decor = dialog.window!!.decorView
        val width = dialog.window!!.attributes.width
        val height = dialog.window!!.attributes.height
        decor.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY))
        decor.layout(0, 0, width, height)
        fun texts(view: View): List<String> = when (view) {
            is TextView -> listOf(view.text.toString())
            is ViewGroup -> (0 until view.childCount).flatMap { texts(view.getChildAt(it)) }
            else -> emptyList()
        }
        assertTrue(texts(decor).containsAll(listOf("iLovePDF", "Adobe Acrobat", "Annuler")))
        assertTrue(width <= activity.resources.displayMetrics.widthPixels)
        val output = File("build/reports/pdf-reader-preview.png").apply { parentFile!!.mkdirs() }
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        decor.draw(Canvas(bitmap))
        output.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
        dialog.dismiss()
        controller.pause().stop().destroy()
    }
}
