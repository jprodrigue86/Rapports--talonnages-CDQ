package ca.balancecdq.android

import android.content.ClipData
import android.content.Intent
import android.net.Uri

/** A PDF reader may advertise VIEW, EDIT, or only an import/share activity. */
internal object DocumentIntents {
    fun candidates(uri: Uri, mime: String, readOnly: Boolean, targetPackage: String? = null): List<Intent> {
        val actions = mutableListOf(Intent.ACTION_VIEW)
        if (!readOnly) actions.add(Intent.ACTION_EDIT)
        actions.add(Intent.ACTION_SEND)
        actions.add(Intent.ACTION_SEND_MULTIPLE)
        return actions.map { action ->
            Intent(action).apply {
                if (action == Intent.ACTION_SEND || action == Intent.ACTION_SEND_MULTIPLE) {
                    type = mime
                    if (action == Intent.ACTION_SEND) putExtra(Intent.EXTRA_STREAM, uri)
                    else putParcelableArrayListExtra(Intent.EXTRA_STREAM, arrayListOf(uri))
                } else setDataAndType(uri, mime)
                targetPackage?.let { setPackage(it) }
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                if (!readOnly && action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE)
                    addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                clipData = ClipData.newRawUri("Document CDQ", uri)
            }
        }
    }
    fun importsCopy(intent: Intent): Boolean =
        intent.action == Intent.ACTION_SEND || intent.action == Intent.ACTION_SEND_MULTIPLE
}
