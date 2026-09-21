package ca.balancecdq.android

import android.app.Activity
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
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
        private const val REQ_AUTH = 24040
        private const val REQ_ACCOUNT = 24041
        private const val DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
    }

    private val executor = Executors.newSingleThreadExecutor()
    private val authClient by lazy { Identity.getAuthorizationClient(this) }

    private var fileId = ""
    private var fileName = "Rapport.pdf"
    private var retriedAccount = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (intent?.data?.host.equals("reset", ignoreCase = true)) {
            openDefaultAppsSettings()
            return
        }

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

        if (newIntent.data?.host.equals("reset", ignoreCase = true)) {
            openDefaultAppsSettings()
            return
        }

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
    }

    private fun isValid(): Boolean =
        fileId.matches(Regex("^[A-Za-z0-9_-]{10,200}$")) &&
            fileName.length <= 180

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

                runOnUiThread {
                    openAndroidPdfResolver(session)
                }
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

    private fun openAndroidPdfResolver(session: PdfSession) {
        val uri = Uri.parse(
            "content://" + packageName + ".pdf/session/" + session.id
        )

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            clipData = ClipData.newRawUri(session.fileName, uri)
        }

        try {
            val targets = packageManager.queryIntentActivities(intent, 0)
            if (targets.isEmpty()) {
                fail("Aucune application PDF compatible n’est installée.")
                return
            }

            targets.forEach { info ->
                val pkg = info.activityInfo?.packageName.orEmpty()
                if (pkg.isNotBlank()) {
                    try {
                        grantUriPermission(pkg, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    } catch (_: Exception) {
                    }
                }
            }

            startActivity(intent)
            finish()
        } catch (_: ActivityNotFoundException) {
            fail("Aucune application PDF compatible n’est installée.")
        } catch (e: Exception) {
            fail(e.message ?: "Impossible d’afficher les applications PDF.")
        }
    }

    private fun openDefaultAppsSettings() {
        try {
            startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
        } catch (_: Exception) {
            try {
                startActivity(
                    Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + packageName)
                    )
                )
            } catch (_: Exception) {
                Toast.makeText(
                    this,
                    "Impossible d’ouvrir les réglages Android.",
                    Toast.LENGTH_LONG
                ).show()
            }
        } finally {
            finish()
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
