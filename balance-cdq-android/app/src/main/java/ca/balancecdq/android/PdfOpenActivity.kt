package ca.balancecdq.android

import android.app.Activity
import android.app.AlertDialog
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.FileProvider
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.Future

class PdfOpenActivity : Activity() {
    companion object {
        private const val REQ_AUTH = 24030
        private const val REQ_ACCOUNT = 24031
        private const val DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
        private const val ILOVEPDF_PACKAGE = "com.ilovepdf.www"
        private const val ACROBAT_PACKAGE = "com.adobe.reader"
    }

    private data class PdfMeta(
        val name: String,
        val size: Long,
        val modifiedTime: String
    )

    private data class PdfApp(
        val label: String,
        val packageName: String
    )

    private val executor = Executors.newFixedThreadPool(2)
    private val authClient by lazy { Identity.getAuthorizationClient(this) }

    private var fileId = ""
    private var fileName = "Rapport.pdf"
    private var reader = "ask"
    private var retriedAccount = false
    private var cacheFuture: Future<File>? = null
    private var progressDialog: AlertDialog? = null

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
        cacheFuture = null
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

                // Commencer tout de suite la mise en cache pendant que l'utilisateur
                // choisit son application. Une seule requête Drive, aucun bloc Apps Script.
                cacheFuture = executor.submit<File> {
                    ensureCachedPdf(token, meta)
                }

                runOnUiThread {
                    when (reader) {
                        "ilovepdf" -> openWithPackage(meta, ILOVEPDF_PACKAGE, "iLovePDF")
                        "acrobat" -> openWithPackage(meta, ACROBAT_PACKAGE, "Adobe Acrobat")
                        else -> showInstalledApps(meta)
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    fail(e.message ?: "Impossible de préparer ce PDF.")
                }
            }
        }
    }

    private fun fetchMetadata(token: String): PdfMeta {
        val url = URL(
            "https://www.googleapis.com/drive/v3/files/" +
                Uri.encode(fileId) +
                "?fields=name,size,mimeType,modifiedTime&supportsAllDrives=true"
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
            val modified = json.optString("modifiedTime", "")

            if (size < 5L) throw IllegalStateException("Le PDF est vide.")
            if (mime != "application/pdf" && !name.endsWith(".pdf", ignoreCase = true)) {
                throw IllegalStateException("Le fichier sélectionné n’est pas un PDF.")
            }

            return PdfMeta(name, size, modified)
        } finally {
            conn.disconnect()
        }
    }

    private fun availablePdfApps(): List<PdfApp> {
        val probe = Intent(Intent.ACTION_VIEW).apply {
            setType("application/pdf")
            addCategory(Intent.CATEGORY_DEFAULT)
        }

        val seen = LinkedHashSet<String>()
        val out = ArrayList<PdfApp>()

        packageManager.queryIntentActivities(probe, PackageManager.MATCH_DEFAULT_ONLY)
            .forEach { info ->
                val pkg = info.activityInfo?.packageName.orEmpty()
                if (pkg.isBlank() || pkg == packageName || !seen.add(pkg)) return@forEach

                val label = try {
                    info.loadLabel(packageManager)?.toString().orEmpty().ifBlank { pkg }
                } catch (_: Exception) {
                    pkg
                }

                out.add(PdfApp(label, pkg))
            }

        return out.sortedWith(
            compareBy<PdfApp> {
                when (it.packageName) {
                    ILOVEPDF_PACKAGE -> 0
                    ACROBAT_PACKAGE -> 1
                    else -> 2
                }
            }.thenBy { it.label.lowercase() }
        )
    }

    private fun showInstalledApps(meta: PdfMeta) {
        val apps = availablePdfApps()
        if (apps.isEmpty()) {
            fail("Aucune application PDF compatible n’est installée.")
            return
        }

        val labels = apps.map { it.label }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("Ouvrir le PDF avec")
            .setItems(labels) { dialog, which ->
                dialog.dismiss()
                val app = apps.getOrNull(which) ?: return@setItems
                openWithPackage(meta, app.packageName, app.label)
            }
            .setNegativeButton("Annuler") { dialog, _ ->
                dialog.dismiss()
                finish()
            }
            .setOnCancelListener { finish() }
            .show()
    }

    private fun openWithPackage(meta: PdfMeta, targetPackage: String, appLabel: String) {
        showOpeningDialog("Ouverture dans $appLabel…")

        executor.execute {
            try {
                val local = cacheFuture?.get() ?: throw IllegalStateException("Copie PDF indisponible.")
                runOnUiThread {
                    dismissOpeningDialog()
                    launchLocalPdf(local, meta.name, targetPackage)
                }
            } catch (e: Exception) {
                runOnUiThread {
                    dismissOpeningDialog()
                    fail(e.cause?.message ?: e.message ?: "Impossible de préparer le PDF.")
                }
            }
        }
    }

    private fun ensureCachedPdf(token: String, meta: PdfMeta): File {
        val dir = File(cacheDir, "pdf-cache").apply { mkdirs() }
        val rev = meta.modifiedTime
            .replace(Regex("[^A-Za-z0-9._-]"), "_")
            .take(48)
            .ifBlank { "current" }

        val finalFile = File(dir, "$fileId-$rev.pdf")

        if (isValidCachedPdf(finalFile, meta.size)) {
            return finalFile
        }

        dir.listFiles()
            ?.filter { it.name.startsWith("$fileId-") && it != finalFile }
            ?.forEach { it.delete() }

        val temp = File(dir, "$fileId-$rev.part")
        if (temp.exists()) temp.delete()

        val url = URL(
            "https://www.googleapis.com/drive/v3/files/" +
                Uri.encode(fileId) +
                "?alt=media&supportsAllDrives=true"
        )

        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10000
            readTimeout = 60000
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Accept", "application/pdf")
        }

        try {
            val code = conn.responseCode
            if (code !in 200..299) {
                throw IllegalStateException("Google Drive a refusé le téléchargement ($code).")
            }

            conn.inputStream.use { input ->
                temp.outputStream().buffered(128 * 1024).use { output ->
                    input.copyTo(output, 128 * 1024)
                }
            }

            if (!isValidCachedPdf(temp, meta.size)) {
                temp.delete()
                throw IllegalStateException("La copie PDF reçue est incomplète.")
            }

            if (finalFile.exists()) finalFile.delete()
            if (!temp.renameTo(finalFile)) {
                temp.copyTo(finalFile, overwrite = true)
                temp.delete()
            }

            if (!isValidCachedPdf(finalFile, meta.size)) {
                finalFile.delete()
                throw IllegalStateException("Impossible de finaliser la copie PDF.")
            }

            return finalFile
        } finally {
            conn.disconnect()
        }
    }

    private fun isValidCachedPdf(file: File, expectedSize: Long): Boolean {
        if (!file.isFile || file.length() != expectedSize || expectedSize < 5L) return false

        return try {
            file.inputStream().use { input ->
                val header = ByteArray(5)
                val count = input.read(header)
                count == 5 && String(header, Charsets.US_ASCII) == "%PDF-"
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun launchLocalPdf(file: File, displayName: String, targetPackage: String) {
        try {
            val uri = FileProvider.getUriForFile(
                this,
                "$packageName.updatefiles",
                file
            )

            grantUriPermission(targetPackage, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/pdf")
                setPackage(targetPackage)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                clipData = ClipData.newRawUri(displayName, uri)
            }

            if (intent.resolveActivity(packageManager) == null) {
                throw ActivityNotFoundException("Application PDF indisponible.")
            }

            startActivity(intent)
            finish()
        } catch (_: ActivityNotFoundException) {
            fail("L’application PDF choisie n’est plus disponible.")
        } catch (e: Exception) {
            fail(e.message ?: "Impossible d’ouvrir le PDF dans cette application.")
        }
    }

    private fun showOpeningDialog(message: String) {
        dismissOpeningDialog()

        val box = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(22), dp(18), dp(22), dp(18))
        }

        val spinner = ProgressBar(this)
        box.addView(
            spinner,
            LinearLayout.LayoutParams(dp(38), dp(38)).apply {
                marginEnd = dp(16)
            }
        )

        val text = TextView(this).apply {
            this.text = message
            textSize = 16f
        }
        box.addView(
            text,
            LinearLayout.LayoutParams(
                0,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                1f
            )
        )

        progressDialog = AlertDialog.Builder(this)
            .setView(box)
            .setCancelable(false)
            .create()
            .also { it.show() }
    }

    private fun dismissOpeningDialog() {
        try {
            progressDialog?.dismiss()
        } catch (_: Exception) {
        }
        progressDialog = null
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    private fun fail(message: String) {
        dismissOpeningDialog()
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        finish()
    }

    override fun onDestroy() {
        dismissOpeningDialog()
        executor.shutdownNow()
        super.onDestroy()
    }
}
