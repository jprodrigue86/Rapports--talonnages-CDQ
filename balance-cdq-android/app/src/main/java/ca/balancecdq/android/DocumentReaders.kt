package ca.balancecdq.android

import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri

internal data class DocumentReader(
    val label: String,
    val packageName: String,
    val importOnly: Boolean = false
)

internal object DocumentReaders {
    const val ILOVEPDF = "com.ilovepdf.www"
    const val ACROBAT = "com.adobe.reader"

    fun label(manager: PackageManager, info: ResolveInfo): String {
        val activity = info.activityInfo ?: return "Lecteur de documents"
        return when (activity.packageName) {
            ILOVEPDF -> "iLovePDF"
            ACROBAT -> "Adobe Acrobat"
            // ResolveInfo.loadLabel can return a tool name such as "Exécuter
            // l'outil". Show the application's identity instead of its action.
            else -> try {
                activity.applicationInfo?.loadLabel(manager)?.toString()
                    ?.takeIf { it.isNotBlank() } ?: activity.packageName
            } catch (_: Exception) { activity.packageName }
        }
    }

    fun available(context: Context, mime: String, readOnly: Boolean): List<DocumentReader> {
        val apps = LinkedHashMap<String, DocumentReader>()
        val extension = if (mime == "text/plain") "txt" else "pdf"
        val uri = Uri.parse("content://${context.packageName}.updatefiles/probe/document.$extension")
        for (probe in DocumentIntents.candidates(uri, mime, readOnly)) {
            context.packageManager.queryIntentActivities(probe, PackageManager.MATCH_DEFAULT_ONLY).forEach { info ->
                val pkg = info.activityInfo?.packageName.orEmpty()
                if (pkg.isBlank() || pkg == context.packageName || apps.containsKey(pkg)) return@forEach
                if (DocumentIntents.importsCopy(probe) && pkg !in setOf(ILOVEPDF, ACROBAT)) return@forEach
                apps[pkg] = DocumentReader(label(context.packageManager, info), pkg, DocumentIntents.importsCopy(probe))
            }
        }
        return apps.values.sortedWith(compareBy<DocumentReader> {
            when (it.packageName) { ILOVEPDF -> 0; ACROBAT -> 1; else -> 2 }
        }.thenBy { it.label.lowercase() })
    }
}
