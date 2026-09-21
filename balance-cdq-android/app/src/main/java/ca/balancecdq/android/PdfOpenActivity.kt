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
import java.security.MessageDigest
import java.util.concurrent.Executors

class PdfOpenActivity : Activity() {
    companion object {
        private const val REQ_ACCOUNT = 25001
        private const val REQ_AUTH = 25002
        private const val REQ_EDITOR = 25003
        private const val DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
        private const val READER_PREFS = "cdq_pdf_reader_v25"
        private const val READER_PACKAGE = "package"
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

    private val executor = Executors.newSingleThreadExecutor()
    private val authClient by lazy { Identity.getAuthorizationClient(this) }

    private var fileId = ""
    private var fileName = "Rapport.pdf"
    private var preferredEmail = ""
    private var readerHint = "ask"
    private var currentToken = ""
    private var selectedReader: PdfApp? = null
    private var localPdf: File? = null
    private var hashBeforeEdit = ""
    private var syncing = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (intent?.data?.host.equals("reset", ignoreCase = true)) {
            resetNativePreferences()
            return
        }

        parseIntent(intent)
        if (!isValid()) {
            fail("Demande PDF invalide.")
            return
        }

        prepareAccount()
    }

    override fun onNewIntent(newIntent: Intent?) {
        super.onNewIntent(newIntent)
        if (newIntent == null) return
        intent = newIntent

        if (newIntent.data?.host.equals("reset", ignoreCase = true)) {
            resetNativePreferences()
            return
        }

        resetSession()
        parseIntent(newIntent)
        if (!isValid()) {
            fail("Demande PDF invalide.")
            return
        }

        prepareAccount()
    }

    private fun resetSession() {
        currentToken = ""
        selectedReader = null
        localPdf = null
        hashBeforeEdit = ""
        syncing = false
    }

    private fun parseIntent(source: Intent) {
        val data = source.data
        fileId = data?.getQueryParameter("fileId").orEmpty()
        fileName = data?.getQueryParameter("name").orEmpty().ifBlank { "Rapport.pdf" }
        preferredEmail = data?.getQueryParameter("account").orEmpty().trim().lowercase()
        readerHint = data?.getQueryParameter("reader").orEmpty().trim().lowercase().ifBlank { "ask" }
    }

    private fun isValid(): Boolean =
        fileId.matches(Regex("^[A-Za-z0-9_-]{10,200}$")) &&
            fileName.length <= 180 &&
            readerHint in setOf("ask", "ilovepdf", "acrobat", "cdq", "")

    private fun prepareAccount() {
        if (preferredEmail.isNotBlank()) {
            val account = DefaultGoogleAccountStore.account(this, preferredEmail)
            if (account != null) {
                DefaultGoogleAccountStore.save(this, preferredEmail)
                authorize(account)
                return
            }
        }

        val saved = DefaultGoogleAccountStore.account(this)
        if (saved != null) {
            authorize(saved)
            return
        }

        chooseAccount()
    }

    private fun chooseAccount() {
        try {
            startActivityForResult(
                DefaultGoogleAccountStore.pickerIntent(this, preferredEmail),
                REQ_ACCOUNT
            )
        } catch (e: Exception) {
            fail(e.message ?: "Impossible d’ouvrir le choix du compte Google.")
        }
    }

    private fun authorize(account: android.accounts.Account) {
        val request = AuthorizationRequest.builder()
            .setRequestedScopes(listOf(Scope(DRIVE_SCOPE)))
            .setAccount(account)
            .build()

        authClient.authorize(request)
            .addOnSuccessListener { result ->
                if (result.hasResolution()) {
                    launchAuthorization(result.pendingIntent)
                } else {
                    consumeAuthorization(result)
                }
            }
            .addOnFailureListener { error ->
                fail(error.message ?: "Impossible d’autoriser Google Drive.")
            }
    }

    private fun launchAuthorization(pendingIntent: PendingIntent?) {
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

    @Deprecated("Résultats Android.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        when (requestCode) {
            REQ_ACCOUNT -> {
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
                val account = DefaultGoogleAccountStore.account(this, email)
                if (account == null) {
                    fail("Le compte Google sélectionné n’est plus disponible.")
                    return
                }
                authorize(account)
            }

            REQ_AUTH -> {
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

            REQ_EDITOR -> syncEditedPdf()
        }
    }

    private fun consumeAuthorization(result: AuthorizationResult) {
        val token = result.accessToken.orEmpty()
        if (token.isBlank()) {
            if (result.hasResolution()) {
                launchAuthorization(result.pendingIntent)
            } else {
                fail("Google n’a pas fourni de jeton Drive.")
            }
            return
        }

        currentToken = token
        chooseReaderBeforeDownload()
    }

    private fun chooseReaderBeforeDownload() {
        val apps = availablePdfApps()
        if (apps.isEmpty()) {
            fail("Aucune application PDF compatible n’est installée.")
            return
        }

        val hintedPackage = when (readerHint) {
            "ilovepdf" -> ILOVEPDF_PACKAGE
            "acrobat" -> ACROBAT_PACKAGE
            else -> ""
        }

        if (hintedPackage.isNotBlank()) {
            val hinted = apps.firstOrNull { it.packageName == hintedPackage }
            if (hinted != null) {
                saveReader(hinted.packageName)
                selectedReader = hinted
                downloadAndOpen()
                return
            }
        }

        val savedPackage = savedReader()
        val saved = apps.firstOrNull { it.packageName == savedPackage }
        if (saved != null) {
            selectedReader = saved
            downloadAndOpen()
            return
        }

        showReaderChooser(apps)
    }

    private fun availablePdfApps(): List<PdfApp> {
        val seen = LinkedHashSet<String>()
        val apps = ArrayList<PdfApp>()

        fun addFrom(action: String) {
            val probe = Intent(action).apply {
                setType("application/pdf")
                addCategory(Intent.CATEGORY_DEFAULT)
            }

            packageManager.queryIntentActivities(
                probe,
                PackageManager.MATCH_DEFAULT_ONLY
            ).forEach { info ->
                val pkg = info.activityInfo?.packageName.orEmpty()
                if (pkg.isBlank() || pkg == packageName || !seen.add(pkg)) return@forEach

                val label = try {
                    info.loadLabel(packageManager)?.toString().orEmpty().ifBlank { pkg }
                } catch (_: Exception) {
                    pkg
                }

                apps.add(PdfApp(label, pkg))
            }
        }

        addFrom(Intent.ACTION_EDIT)
        addFrom(Intent.ACTION_VIEW)

        return apps.sortedWith(
            compareBy<PdfApp> {
                when (it.packageName) {
                    ILOVEPDF_PACKAGE -> 0
                    ACROBAT_PACKAGE -> 1
                    else -> 2
                }
            }.thenBy { it.label.lowercase() }
        )
    }

    private fun showReaderChooser(apps: List<PdfApp>) {
        val labels = apps.map { it.label }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("Application PDF par défaut")
            .setMessage("Choisis l’application à utiliser. Balance CDQ mémorisera ce choix.")
            .setItems(labels) { dialog, which ->
                dialog.dismiss()
                val app = apps.getOrNull(which) ?: return@setItems
                saveReader(app.packageName)
                selectedReader = app
                Toast.makeText(
                    this,
                    "Lecteur PDF par défaut : ${app.label}",
                    Toast.LENGTH_SHORT
                ).show()
                downloadAndOpen()
            }
            .setNegativeButton("Annuler") { dialog, _ ->
                dialog.dismiss()
                finish()
            }
            .setOnCancelListener { finish() }
            .show()
    }

    private fun savedReader(): String =
        getSharedPreferences(READER_PREFS, MODE_PRIVATE)
            .getString(READER_PACKAGE, "")
            .orEmpty()

    private fun saveReader(targetPackage: String) {
        getSharedPreferences(READER_PREFS, MODE_PRIVATE)
            .edit()
            .putString(READER_PACKAGE, targetPackage)
            .apply()
    }

    private fun clearReader() {
        getSharedPreferences(READER_PREFS, MODE_PRIVATE)
            .edit()
            .remove(READER_PACKAGE)
            .apply()
    }

    private fun downloadAndOpen() {
        val token = currentToken
        val app = selectedReader

        if (token.isBlank() || app == null) {
            fail("Préparation PDF incomplète.")
            return
        }

        executor.execute {
            try {
                val meta = fetchMetadata(token)
                val file = obtainLocalPdf(token, meta)
                localPdf = file
                hashBeforeEdit = sha256(file)

                runOnUiThread {
                    launchEditor(file, app)
                }
            } catch (e: Exception) {
                runOnUiThread {
                    fail(e.message ?: "Impossible d’ouvrir ce PDF.")
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

    private fun obtainLocalPdf(token: String, meta: PdfMeta): File {
        val dir = File(cacheDir, "pdf-cache").apply { mkdirs() }
        val safeName = meta.name
            .replace(Regex("[\\/:*?\"<>|\\u0000-\\u001f]"), "_")
            .take(120)
            .ifBlank { "Rapport.pdf" }
            .let { if (it.endsWith(".pdf", true)) it else "$it.pdf" }

        val rev = meta.modifiedTime
            .replace(Regex("[^A-Za-z0-9._-]"), "_")
            .take(48)
            .ifBlank { "current" }

        val finalFile = File(dir, "${fileId.take(20)}-$rev-$safeName")

        if (finalFile.isFile && finalFile.length() == meta.size && isPdf(finalFile)) {
            cleanupOlderCopies(dir, finalFile)
            return finalFile
        }

        cleanupOlderCopies(dir, finalFile)

        val temp = File(dir, finalFile.name + ".part")
        if (temp.exists()) temp.delete()

        val url = URL(
            "https://www.googleapis.com/drive/v3/files/" +
                Uri.encode(fileId) +
                "?alt=media&supportsAllDrives=true"
        )

        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10000
            readTimeout = 45000
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Accept", "application/pdf")
        }

        try {
            val code = conn.responseCode
            if (code !in 200..299) {
                throw IllegalStateException("Google Drive a refusé le PDF ($code).")
            }

            conn.inputStream.use { input ->
                temp.outputStream().buffered(256 * 1024).use { output ->
                    input.copyTo(output, 256 * 1024)
                }
            }

            if (temp.length() != meta.size || !isPdf(temp)) {
                temp.delete()
                throw IllegalStateException("Le PDF reçu est incomplet.")
            }

            if (finalFile.exists()) finalFile.delete()
            if (!temp.renameTo(finalFile)) {
                temp.copyTo(finalFile, overwrite = true)
                temp.delete()
            }

            return finalFile
        } finally {
            conn.disconnect()
        }
    }

    private fun cleanupOlderCopies(dir: File, keep: File) {
        dir.listFiles()
            ?.filter { it != keep && it.name.startsWith(fileId.take(20) + "-") }
            ?.forEach { it.delete() }
    }

    private fun isPdf(file: File): Boolean =
        try {
            file.inputStream().use { input ->
                val head = ByteArray(5)
                input.read(head) == 5 && String(head, Charsets.US_ASCII) == "%PDF-"
            }
        } catch (_: Exception) {
            false
        }

    private fun launchEditor(file: File, app: PdfApp) {
        try {
            val uri = FileProvider.getUriForFile(
                this,
                "$packageName.updatefiles",
                file
            )

            val flags =
                Intent.FLAG_GRANT_READ_URI_PERMISSION or
                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION

            grantUriPermission(app.packageName, uri, flags)

            val editIntent = Intent(Intent.ACTION_EDIT).apply {
                setDataAndType(uri, "application/pdf")
                setPackage(app.packageName)
                addFlags(flags)
                clipData = ClipData.newRawUri(file.name, uri)
            }

            val viewIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/pdf")
                setPackage(app.packageName)
                addFlags(flags)
                clipData = ClipData.newRawUri(file.name, uri)
            }

            val chosen = if (editIntent.resolveActivity(packageManager) != null) {
                editIntent
            } else {
                viewIntent
            }

            if (chosen.resolveActivity(packageManager) == null) {
                clearReader()
                throw ActivityNotFoundException("Le lecteur PDF choisi n’est plus disponible.")
            }

            startActivityForResult(chosen, REQ_EDITOR)
        } catch (e: Exception) {
            clearReader()
            fail(e.message ?: "Impossible d’ouvrir le lecteur PDF.")
        }
    }

    private fun syncEditedPdf() {
        if (syncing) return
        val file = localPdf ?: run {
            finish()
            return
        }

        syncing = true

        executor.execute {
            try {
                val after = sha256(file)

                if (after == hashBeforeEdit) {
                    runOnUiThread {
                        syncing = false
                        finish()
                    }
                    return@execute
                }

                uploadPdf(currentToken, file)

                runOnUiThread {
                    Toast.makeText(
                        this,
                        "PDF enregistré dans Google Drive.",
                        Toast.LENGTH_SHORT
                    ).show()
                    syncing = false
                    finish()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    syncing = false
                    Toast.makeText(
                        this,
                        e.message ?: "Impossible d’enregistrer le PDF dans Drive.",
                        Toast.LENGTH_LONG
                    ).show()
                    finish()
                }
            }
        }
    }

    private fun uploadPdf(token: String, file: File) {
        if (token.isBlank()) throw IllegalStateException("Autorisation Google Drive expirée.")

        val url = URL(
            "https://www.googleapis.com/upload/drive/v3/files/" +
                Uri.encode(fileId) +
                "?uploadType=media&supportsAllDrives=true"
        )

        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "PATCH"
            connectTimeout = 12000
            readTimeout = 60000
            doOutput = true
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Content-Type", "application/pdf")
            setFixedLengthStreamingMode(file.length())
        }

        try {
            file.inputStream().buffered(256 * 1024).use { input ->
                conn.outputStream.buffered(256 * 1024).use { output ->
                    input.copyTo(output, 256 * 1024)
                }
            }

            val code = conn.responseCode
            if (code !in 200..299) {
                val body = conn.errorStream
                    ?.bufferedReader()
                    ?.use { it.readText() }
                    .orEmpty()
                throw IllegalStateException(
                    if (code == 401) {
                        "L’autorisation Google Drive a expiré. Rouvre le PDF et réessaie."
                    } else {
                        "Google Drive a refusé l’enregistrement ($code)." +
                            if (body.isNotBlank()) " ${body.take(180)}" else ""
                    }
                )
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(128 * 1024)
            var read: Int
            while (input.read(buffer).also { read = it } >= 0) {
                if (read > 0) digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun resetNativePreferences() {
        DefaultGoogleAccountStore.clear(this)
        clearReader()
        Toast.makeText(
            this,
            "Compte Google et lecteur PDF par défaut réinitialisés.",
            Toast.LENGTH_LONG
        ).show()
        finish()
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
