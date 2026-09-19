package ca.balancecdq.android

import android.app.Activity
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class PdfOpenActivity : Activity() {
    companion object {
        private const val REQ_AUTH = 22730
        private const val DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
    }

    private val executor = Executors.newSingleThreadExecutor()
    private val authClient by lazy { Identity.getAuthorizationClient(this) }

    private var fileId = ""
    private var fileName = "Rapport.pdf"
    private var reader = "ask"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        parseIntent(intent)
        if (!isValid()) {
            fail("Demande PDF invalide.")
            return
        }
        requestGoogleAccount()
    }

    override fun onNewIntent(newIntent: Intent?) {
        super.onNewIntent(newIntent)
        if (newIntent == null) return
        intent = newIntent
        parseIntent(newIntent)
        if (!isValid()) {
            fail("Demande PDF invalide.")
            return
        }
        requestGoogleAccount()
    }

    private fun parseIntent(source: Intent) {
        val data = source.data
        fileId = data?.getQueryParameter("fileId").orEmpty()
        fileName = data?.getQueryParameter("name").orEmpty().ifBlank { "Rapport.pdf" }
        reader = data?.getQueryParameter("reader").orEmpty().ifBlank { "ask" }
    }

    private fun isValid(): Boolean {
        return fileId.matches(Regex("^[A-Za-z0-9_-]{10,200}$")) &&
            fileName.length <= 180 &&
            reader in setOf("ask", "ilovepdf", "acrobat")
    }

    private fun requestGoogleAccount() {
        val request = AuthorizationRequest.builder()
            .setRequestedScopes(listOf(Scope(DRIVE_SCOPE)))
            .setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT)
            .build()

        authClient.authorize(request)
            .addOnSuccessListener { result ->
                if (result.hasResolution()) {
                    launchResolution(result.pendingIntent)
                } else {
                    consumeAuthorization(result)
                }
            }
            .addOnFailureListener { error ->
                fail(error.message ?: "Impossible d’ouvrir le choix du compte Google.")
            }
    }

    private fun launchResolution(pending: PendingIntent?) {
        if (pending == null) {
            fail("Le choix du compte Google n’est pas disponible.")
            return
        }
        try {
            startIntentSenderForResult(
                pending.intentSender,
                REQ_AUTH,
                null,
                0,
                0,
                0
            )
        } catch (e: Exception) {
            fail(e.message ?: "Impossible d’ouvrir le choix du compte Google.")
        }
    }

    @Deprecated("Utilisé pour le résultat de Google AuthorizationClient.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_AUTH) return
        if (resultCode != RESULT_OK || data == null) {
            finish()
            return
        }
        try {
            val result = authClient.getAuthorizationResultFromIntent(data)
            consumeAuthorization(result)
        } catch (e: Exception) {
            fail(e.message ?: "Google n’a pas confirmé le compte.")
        }
    }

    private fun consumeAuthorization(result: AuthorizationResult) {
        val token = result.accessToken.orEmpty()
        if (token.isBlank()) {
            if (result.hasResolution()) {
                launchResolution(result.pendingIntent)
            } else {
                fail("Google n’a pas fourni l’accès au PDF.")
            }
            return
        }

        executor.execute {
            try {
                val meta = fetchMetadata(token)
                val resolvedName = meta.first.ifBlank { fileName }
                val size = meta.second
                val session = PdfSessionStore.create(
                    applicationContext,
                    fileId,
                    resolvedName,
                    token,
                    size
                )
                runOnUiThread { openReader(session) }
            } catch (e: Exception) {
                runOnUiThread {
                    fail(e.message ?: "Impossible d’ouvrir ce PDF avec ce compte.")
                }
            }
        }
    }

    private fun fetchMetadata(token: String): Pair<String, Long> {
        val url = URL(
            "https://www.googleapis.com/drive/v3/files/" +
                Uri.encode(fileId) +
                "?fields=name,size,mimeType&supportsAllDrives=true"
        )
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 12000
            readTimeout = 12000
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Accept", "application/json")
        }

        try {
            val code = conn.responseCode
            val body = (if (code in 200..299) conn.inputStream else conn.errorStream)
                ?.bufferedReader()
                ?.use { it.readText() }
                .orEmpty()

            if (code !in 200..299) {
                throw IllegalStateException(
                    if (code == 403 || code == 404)
                        "Ce compte Google n’a pas accès à ce PDF."
                    else
                        "Google Drive a refusé le PDF ($code)."
                )
            }

            val json = JSONObject(body)
            val mime = json.optString("mimeType")
            val name = json.optString("name", fileName)
            val size = json.optLong("size", 0L)
            if (size < 5L) throw IllegalStateException("Le PDF est vide.")
            if (mime != "application/pdf" && !name.endsWith(".pdf", ignoreCase = true)) {
                throw IllegalStateException("Le fichier sélectionné n’est pas un PDF.")
            }
            return name to size
        } finally {
            conn.disconnect()
        }
    }

    private fun openReader(session: PdfSession) {
        val uri = Uri.parse(
            "content://ca.balancecdq.android.pdf/session/${session.id}"
        )

        val base = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            clipData = ClipData.newRawUri(session.fileName, uri)
        }

        val targetPackage = when (reader.lowercase()) {
            "ilovepdf" -> "com.ilovepdf.www"
            "acrobat" -> "com.adobe.reader"
            else -> ""
        }

        try {
            if (targetPackage.isNotBlank()) {
                val direct = Intent(base).apply { setPackage(targetPackage) }
                if (direct.resolveActivity(packageManager) != null) {
                    startActivity(direct)
                    finish()
                    return
                }
            }

            startActivity(Intent.createChooser(base, "Ouvrir le PDF avec"))
            finish()
        } catch (_: ActivityNotFoundException) {
            fail("Aucun lecteur PDF compatible n’est installé.")
        }
    }

    private fun fail(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        finish()
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }
}
