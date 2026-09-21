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
        private const val REQ_AUTH = 24020
        private const val REQ_ACCOUNT = 24021
        private const val DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
    }

    private val executor = Executors.newSingleThreadExecutor()
    private val authClient by lazy { Identity.getAuthorizationClient(this) }

    private var fileId = ""
    private var fileName = "Rapport.pdf"
    private var reader = "ask"
    private var retriedAccount = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        parseIntent(intent)
        if (!isValid()) {
            fail("Demande PDF invalide.")
            return
        }
        authorizeDefaultAccount()
    }

    override fun onNewIntent(newIntent: Intent?) {
        super.onNewIntent(newIntent)
        if (newIntent == null) return
        intent = newIntent
        retriedAccount = false
        parseIntent(newIntent)
        if (!isValid()) {
            fail("Demande PDF invalide.")
            return
        }
        authorizeDefaultAccount()
    }

    private fun parseIntent(source: Intent) {
        val data = source.data
        fileId = data?.getQueryParameter("fileId").orEmpty()
        fileName = data?.getQueryParameter("name").orEmpty().ifBlank { "Rapport.pdf" }
        reader = data?.getQueryParameter("reader").orEmpty().lowercase().ifBlank { "ask" }
    }

    private fun isValid(): Boolean =
        fileId.matches(Regex("^[A-Za-z0-9_-]{10,200}$")) &&
            fileName.length <= 180 &&
            reader in setOf("ask", "ilovepdf", "acrobat")

    private fun chooseDefaultAccount() {
        try {
            startActivityForResult(
                DefaultGoogleAccountStore.pickerIntent(this),
                REQ_ACCOUNT
            )
        } catch (e: Exception) {
            fail(e.message ?: "Impossible d’ouvrir le choix du compte Google.")
        }
    }

    private fun authorizeDefaultAccount() {
        val account = DefaultGoogleAccountStore.account(this)
        if (account == null) {
            chooseDefaultAccount()
            return
        }

        val request = AuthorizationRequest.builder()
            .setRequestedScopes(listOf(Scope(DRIVE_SCOPE)))
            .setAccount(account)
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
                if (!retriedAccount) {
                    retriedAccount = true
                    chooseDefaultAccount()
                } else {
                    fail(error.message ?: "Impossible d’autoriser Google Drive.")
                }
            }
    }

    private fun launchResolution(pendingIntent: PendingIntent?) {
        if (pendingIntent == null) {
            fail("Google n’a pas fourni l’autorisation Drive.")
            return
        }

        try {
            startIntentSenderForResult(
                pendingIntent.intentSender,
                REQ_AUTH,
                null,
                0,
                0,
                0
            )
        } catch (e: Exception) {
            fail(e.message ?: "Impossible d’autoriser Google Drive.")
        }
    }

    @Deprecated("Résultats Google.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == REQ_ACCOUNT) {
            if (resultCode != RESULT_OK) {
                finish()
                return
            }

            val email = DefaultGoogleAccountStore.readResult(data)
            if (email.isBlank()) {
                finish()
                return
            }

            DefaultGoogleAccountStore.save(this, email)
            retriedAccount = true
            authorizeDefaultAccount()
            return
        }

        if (requestCode != REQ_AUTH) return

        if (resultCode != RESULT_OK || data == null) {
            finish()
            return
        }

        try {
            consumeAuthorization(authClient.getAuthorizationResultFromIntent(data))
        } catch (e: Exception) {
            fail(e.message ?: "Google n’a pas confirmé l’autorisation Drive.")
        }
    }

    private fun consumeAuthorization(result: AuthorizationResult) {
        val token = result.accessToken.orEmpty()
        if (token.isBlank()) {
            if (result.hasResolution()) {
                launchResolution(result.pendingIntent)
            } else {
                fail("Google n’a pas fourni de jeton Drive.")
            }
            return
        }

        executor.execute {
            try {
                val meta = fetchMetadata(token)
                val session = PdfSessionStore.create(
                    applicationContext,
                    fileId,
                    meta.first.ifBlank { fileName },
                    token,
                    meta.second
                )
                runOnUiThread { openInstalledReader(session) }
            } catch (e: Exception) {
                runOnUiThread {
                    fail(e.message ?: "Impossible d’ouvrir ce PDF.")
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
            connectTimeout = 8000
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
                    when (code) {
                        401 -> "L’autorisation Google Drive a expiré."
                        403, 404 -> "Le compte Google par défaut n’a pas accès à ce PDF."
                        else -> "Google Drive a refusé le PDF ($code)."
                    }
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

    private fun openInstalledReader(session: PdfSession) {
        val uri = Uri.parse(
            "content://$packageName.pdf/session/\${session.id}"
        )

        val base = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            clipData = ClipData.newRawUri(session.fileName, uri)
        }

        val targetPackage = when (reader) {
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

            val chooser = Intent.createChooser(base, "Ouvrir le PDF avec").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(chooser)
            finish()
        } catch (_: ActivityNotFoundException) {
            fail("Aucune application PDF compatible n’est installée.")
        } catch (e: Exception) {
            fail(e.message ?: "Impossible d’afficher les applications PDF.")
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
