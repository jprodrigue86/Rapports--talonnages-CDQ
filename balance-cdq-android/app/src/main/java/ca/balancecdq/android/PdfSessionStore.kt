package ca.balancecdq.android

import android.content.Context
import org.json.JSONObject
import java.util.UUID

data class PdfSession(
    val id: String,
    val fileId: String,
    val fileName: String,
    val accessToken: String,
    val size: Long,
    val expiresAt: Long
)

object PdfSessionStore {
    private const val PREFS = "cdq_pdf_sessions_v1"

    fun create(
        context: Context,
        fileId: String,
        fileName: String,
        accessToken: String,
        size: Long
    ): PdfSession {
        cleanup(context)
        val session = PdfSession(
            id = UUID.randomUUID().toString(),
            fileId = fileId,
            fileName = fileName,
            accessToken = accessToken,
            size = size,
            expiresAt = System.currentTimeMillis() + 50L * 60L * 1000L
        )
        val json = JSONObject()
            .put("id", session.id)
            .put("fileId", session.fileId)
            .put("fileName", session.fileName)
            .put("accessToken", session.accessToken)
            .put("size", session.size)
            .put("expiresAt", session.expiresAt)

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(session.id, json.toString())
            .apply()
        return session
    }

    fun load(context: Context, id: String): PdfSession? {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(id, null) ?: return null
        return try {
            val json = JSONObject(raw)
            val expires = json.optLong("expiresAt", 0L)
            if (expires <= System.currentTimeMillis()) {
                remove(context, id)
                null
            } else {
                PdfSession(
                    id = json.getString("id"),
                    fileId = json.getString("fileId"),
                    fileName = json.optString("fileName", "Rapport.pdf"),
                    accessToken = json.getString("accessToken"),
                    size = json.getLong("size"),
                    expiresAt = expires
                )
            }
        } catch (_: Exception) {
            remove(context, id)
            null
        }
    }

    fun remove(context: Context, id: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(id)
            .apply()
    }

    private fun cleanup(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val edit = prefs.edit()
        val now = System.currentTimeMillis()
        prefs.all.forEach { (key, value) ->
            try {
                val expires = JSONObject(value?.toString().orEmpty()).optLong("expiresAt", 0L)
                if (expires <= now) edit.remove(key)
            } catch (_: Exception) {
                edit.remove(key)
            }
        }
        edit.apply()
    }
}
