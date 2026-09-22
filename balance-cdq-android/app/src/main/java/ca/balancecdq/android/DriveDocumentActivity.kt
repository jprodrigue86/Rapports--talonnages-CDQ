package ca.balancecdq.android

import android.app.Activity
import android.app.AlertDialog
import android.app.Dialog
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
import com.google.android.gms.common.api.ApiException
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

open class DriveDocumentActivity : Activity() {
    protected open val documentMime: String = "application/pdf"
    private val documentExtension: String get() = if (documentMime == "text/plain") ".txt" else ".pdf"
    private val defaultName: String get() = if (documentMime == "text/plain") "Note.txt" else "Rapport.pdf"

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

    private val executor = Executors.newSingleThreadExecutor()
    private val authClient by lazy { Identity.getAuthorizationClient(this) }

    private var fileId = ""
    private var fileName = "Rapport.pdf"
    private var preferredEmail = ""
    private var sessionEmail = ""
    private var readOnly = false
    private var accountMode = "auto"
    private var readerHint = "ask"
    private var currentToken = ""
    private var selectedReader: DocumentReader? = null
    private var localPdf: File? = null
    private var hashBeforeEdit = ""
    private var syncing = false
    private var authorizationStarted = false
    private var pendingAuthorization: PendingIntent? = null
    private var opening = false
    private var cacheRecordKey = ""
    private var importCopy = false
    private var pendingEdits = false
    private var statusDialog: AlertDialog? = null
    private var readerDialog: Dialog? = null

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
        sessionEmail = ""
        selectedReader = null
        localPdf = null
        hashBeforeEdit = ""
        syncing = false
        authorizationStarted = false
        pendingAuthorization = null
        opening = false
        importCopy = false
        pendingEdits = false
    }

    private fun parseIntent(source: Intent) {
        val data = source.data
        fileId = data?.getQueryParameter("fileId").orEmpty()
        fileName = data?.getQueryParameter("name").orEmpty().ifBlank { defaultName }
        preferredEmail = data?.getQueryParameter("account").orEmpty().trim().lowercase()
        accountMode = data?.getQueryParameter("accountMode").orEmpty().trim().lowercase().ifBlank { "auto" }
        readOnly = data?.getQueryParameter("readOnly") == "1"
        readerHint = if (documentMime == "text/plain") "system" else data?.getQueryParameter("reader").orEmpty().trim().lowercase().ifBlank { "ask" }
    }

    private fun isValid(): Boolean =
        fileId.matches(Regex("^[A-Za-z0-9_-]{10,200}$")) &&
            fileName.length <= 180 &&
            accountMode in setOf("ask", "default", "auto") &&
            readerHint in setOf("ask", "ilovepdf", "acrobat", "cdq", "system", "")

    private fun prepareAccount() {

        // "ask" signifie qu'aucun compte par défaut n'est configuré dans
        // Balance CDQ. Le sélecteur doit donc apparaître à CHAQUE ouverture.
        if (accountMode == "ask") {
            chooseAccount()
            return
        }

        if (preferredEmail.isNotBlank()) {
            if (accountMode == "default") {
                DefaultGoogleAccountStore.save(this, preferredEmail)
            }
            accountChosen(preferredEmail)
            return
        }

        val savedEmail = DefaultGoogleAccountStore.email(this)
        if (savedEmail.isNotBlank()) {
            accountChosen(savedEmail)
            return
        }

        chooseAccount()
    }

    private fun chooseAccount() {
        try {
            startActivityForResult(
                DefaultGoogleAccountStore.pickerIntent(
                    this,
                    preferredEmail,
                    if (accountMode == "ask")
                        "Choisir le compte Google — Balance CDQ"
                    else
                        "Compte Google par défaut — Balance CDQ"
                ),
                REQ_ACCOUNT
            )
        } catch (e: Exception) {
            fail(e.message ?: "Impossible d’ouvrir le choix du compte Google.")
        }
    }

    private fun accountChosen(email: String) {
        sessionEmail = email
        // A cached Google grant is obtained while the user selects a reader.
        // Interactive consent is deferred until the chooser has closed.
        if (selectedReader == null) chooseReaderBeforeDownload()
        if (!isFinishing && !isDestroyed) authorizeSelectedAccount()
    }

    private fun authorizeSelectedAccount() {
        if (authorizationStarted) { continueOpening(); return }
        authorizationStarted = true
        authorize(android.accounts.Account(sessionEmail, DefaultGoogleAccountStore.GOOGLE_ACCOUNT_TYPE))
    }

    private fun continueOpening() {
        if (selectedReader == null || isFinishing || isDestroyed) return
        val consent = pendingAuthorization
        if (consent != null) {
            pendingAuthorization = null
            launchAuthorization(consent)
        } else if (currentToken.isNotBlank()) {
            if (pendingEdits && localPdf != null) syncEditedPdf()
            else if (!opening) downloadAndOpen()
        }
    }

    private fun authorize(account: android.accounts.Account) {
        val request = AuthorizationRequest.builder()
            .setRequestedScopes(listOf(Scope(if (readOnly) "$DRIVE_SCOPE.readonly" else DRIVE_SCOPE)))
            .setAccount(account)
            .build()

        authClient.authorize(request)
            .addOnSuccessListener { result ->
                if (result.hasResolution()) {
                    pendingAuthorization = result.pendingIntent
                    continueOpening()
                } else {
                    consumeAuthorization(result)
                }
            }
            .addOnFailureListener { error ->
                authorizationStarted = false
                val detail = if (error is ApiException && error.statusCode == 10)
                    "La configuration Google de l’application Android ne permet pas l’accès Drive (code 10). Le client OAuth Android doit correspondre au nom ca.balancecdq.android et à la signature de cet APK."
                else "Google Drive n’a pas autorisé le compte $sessionEmail. " + (error.message ?: "Réessayez la connexion.")
                fail(detail, allowDrive = true)
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

                if (accountMode != "ask") {
                    DefaultGoogleAccountStore.save(this, email)
                }
                accountChosen(email)
            }

            REQ_AUTH -> {
                pendingAuthorization = null
                if (resultCode != RESULT_OK || data == null) {
                    authorizationStarted = false
                    fail(
                        "L’autorisation Google a été fermée sans donner accès au document. " +
                            "Aucun PDF n’a été envoyé au lecteur. Réessayez pour autoriser l’accès.",
                        allowDrive = true
                    )
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
        continueOpening()
    }

    private fun chooseReaderBeforeDownload() {
        val apps = availablePdfApps()
        if (apps.isEmpty()) {
            fail("Aucune application compatible avec ce document n’est installée.")
            return
        }

        if (documentMime == "text/plain") {
            val resolved = packageManager.resolveActivity(
                Intent(Intent.ACTION_VIEW).setDataAndType(
                    Uri.parse("content://$packageName.updatefiles/probe/note.txt"), documentMime
                ), PackageManager.MATCH_DEFAULT_ONLY
            )?.activityInfo?.packageName
            val defaultApp = apps.firstOrNull { it.packageName == resolved }
            if (defaultApp != null) {
                selectedReader = defaultApp
                authorizeSelectedAccount()
            } else {
                showReaderChooser(apps, rememberChoice = false)
            }
            return
        }

        // "Demander" dans Balance CDQ = aucun lecteur par défaut.
        // On demande donc l'application à CHAQUE PDF et on ne mémorise pas
        // le choix fait pour ce document.
        if (readerHint == "ask") {
            showReaderChooser(apps, rememberChoice = false)
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
                authorizeSelectedAccount()
                return
            }

            // Le lecteur configuré n'est plus installé : demander lequel utiliser.
            showReaderChooser(apps, rememberChoice = false)
            return
        }

        // Compatibilité avec les anciens appels sans préférence explicite.
        val savedPackage = savedReader()
        val saved = apps.firstOrNull { it.packageName == savedPackage }
        if (saved != null) {
            selectedReader = saved
            authorizeSelectedAccount()
            return
        }

        showReaderChooser(apps, rememberChoice = true)
    }

    private fun availablePdfApps(): List<DocumentReader> =
        DocumentReaders.available(this, documentMime, readOnly)

    private fun showReaderChooser(apps: List<DocumentReader>, rememberChoice: Boolean) {
        readerDialog?.dismiss()
        readerDialog = DocumentReaderDialog.show(
            this, fileName, apps, rememberChoice,
            onSelected = { app ->
                if (rememberChoice) saveReader(app.packageName)
                selectedReader = app
                authorizeSelectedAccount()
            },
            onCancel = { finish() }
        )
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

        opening = true
        statusDialog?.dismiss()
        statusDialog = AlertDialog.Builder(this).setTitle("Ouverture du document")
            .setMessage("Connexion à Google Drive…")
            .setNegativeButton("Annuler") { _, _ -> finish() }
            .setOnCancelListener { finish() }.show()
        executor.execute {
            try {
                val file = obtainLocalDocument(token)
                localPdf = file
                hashBeforeEdit = sha256(file)

                runOnUiThread {
                    statusDialog?.dismiss()
                    if (!isFinishing && !isDestroyed) launchEditor(file, app)
                }
            } catch (e: Exception) {
                runOnUiThread {
                    fail(e.message ?: "Impossible d’ouvrir ce PDF.")
                }
            }
        }
    }

    private fun obtainLocalDocument(token: String): File {
        val accountKey = MessageDigest.getInstance("SHA-256").digest(sessionEmail.toByteArray()).joinToString("") { "%02x".format(it) }
        val dir = File(cacheDir, "pdf-cache/$accountKey").apply { mkdirs() }
        val records = getSharedPreferences("cdq_document_cache_v2512", MODE_PRIVATE)
        cacheRecordKey = "$accountKey/$fileId"
        val record = try { JSONObject(records.getString(cacheRecordKey, "{}").orEmpty()) } catch (_: Exception) { JSONObject() }
        val savedName = record.optString("name")
        val safeName = fileName.replace(Regex("[^\\p{L}\\p{N}._ -]"), "_").take(120).ifBlank { defaultName }
            .let { if (it.endsWith(documentExtension, true)) it else "$it$documentExtension" }
        val cached = File(dir, if (savedName.isNotBlank() && !savedName.contains('/') && !savedName.contains('\\')) savedName else "$fileId-$safeName")
        if (cached.isFile && record.optString("hash").isNotBlank() && sha256(cached) != record.optString("hash")) {
            pendingEdits = true
            localPdf = cached
            hashBeforeEdit = record.optString("hash")
            throw IllegalStateException("Ce document contient des modifications non envoyées. Utilisez Réessayer l’enregistrement avant de télécharger une autre version.")
        }
        val reusable = cached.isFile && isDocument(cached) && record.optString("etag").isNotBlank()
        val connection = (URL("https://www.googleapis.com/drive/v3/files/" + Uri.encode(fileId) + "?alt=media&supportsAllDrives=true").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 8000
            readTimeout = 30000
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Accept", documentMime)
            if (reusable) setRequestProperty("If-None-Match", record.optString("etag"))
        }
        val part = File(dir, cached.name + ".part")
        try {
            val code = connection.responseCode
            if (code == 304 && reusable) return cached
            if (code !in 200..299) throw IllegalStateException(when (code) {
                401 -> "L’autorisation Google Drive a expiré. Réessayez."
                403, 404 -> "Le compte $sessionEmail n’a pas accès à ce document (Drive $code)."
                else -> "Google Drive ne peut pas fournir le document ($code)."
            })
            runOnUiThread { statusDialog?.setMessage("Téléchargement du document…") }
            connection.inputStream.use { input -> part.outputStream().buffered(256 * 1024).use { input.copyTo(it, 256 * 1024) } }
            val expected = connection.contentLengthLong
            if ((expected >= 0 && part.length() != expected) || !isDocument(part)) throw IllegalStateException("Le document reçu est incomplet ou n’est pas un $documentExtension.")
            if (!part.renameTo(cached)) { part.copyTo(cached, overwrite = true); part.delete() }
            val next = JSONObject().put("name", cached.name).put("etag", connection.getHeaderField("ETag").orEmpty()).put("hash", sha256(cached))
            records.edit().putString(cacheRecordKey, next.toString()).apply()
            return cached
        } finally {
            part.delete()
            connection.disconnect()
        }
    }

    private fun isDocument(file: File): Boolean =
        try {
            if (documentMime == "text/plain") file.isFile else file.inputStream().use { input ->
                val head = ByteArray(5)
                input.read(head) == 5 && String(head, Charsets.US_ASCII) == "%PDF-"
            }
        } catch (_: Exception) {
            false
        }

    private fun launchEditor(file: File, app: DocumentReader) {
        val uri = FileProvider.getUriForFile(this, "$packageName.updatefiles", file)
        val intents = DocumentIntents.candidates(uri, documentMime, readOnly, app.packageName)
        var lastError: Exception? = null
        for (candidate in intents) {
            if (candidate.resolveActivity(packageManager) == null) continue
            try {
                importCopy = DocumentIntents.importsCopy(candidate)
                if (importCopy && !readOnly) {
                    AlertDialog.Builder(this).setTitle("Importer dans ${app.label}")
                        .setMessage("Ce lecteur importe une copie. Ses modifications devront être enregistrées ou partagées vers Google Drive depuis le lecteur.")
                        .setPositiveButton("Ouvrir") { _, _ ->
                            try { startActivityForResult(candidate, REQ_EDITOR) }
                            catch (_: Exception) { fail("${app.label} n’a pas accepté le document.") }
                        }
                        .setNegativeButton("Autre lecteur") { _, _ -> selectedReader = null; opening = false; chooseReaderBeforeDownload() }
                        .setOnCancelListener { finish() }.show()
                } else startActivityForResult(candidate, REQ_EDITOR)
                return
            } catch (error: Exception) { lastError = error }
        }
        clearReader()
        fail(lastError?.message ?: "${app.label} n’a pas accepté ce document. Choisissez un autre lecteur.")
    }

    private fun syncEditedPdf() {
        if (readOnly || importCopy) { finish(); return }
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

                pendingEdits = true
                uploadPdf(currentToken, file)
                pendingEdits = false
                getSharedPreferences("cdq_document_cache_v2512", MODE_PRIVATE).edit()
                    .putString(cacheRecordKey, JSONObject().put("name", file.name).put("etag", "").put("hash", after).toString()).apply()

                runOnUiThread {
                    Toast.makeText(
                        this,
                        "Document enregistré dans Google Drive.",
                        Toast.LENGTH_SHORT
                    ).show()
                    syncing = false
                    finish()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    syncing = false
                    fail(e.message ?: "Impossible d’enregistrer le document dans Drive.")
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
            setRequestProperty("Content-Type", documentMime)
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

    private fun fail(message: String, allowDrive: Boolean = false) {
        if (isFinishing || isDestroyed) return
        opening = false
        statusDialog?.dismiss()
        readerDialog?.dismiss()
        val dialog = AlertDialog.Builder(this).setTitle("Le document n’a pas pu être ouvert")
            .setMessage(message)
            .setNegativeButton("Fermer") { _, _ -> finish() }
            .setOnCancelListener { finish() }
        if (pendingEdits && localPdf != null && hashBeforeEdit.isNotBlank()) {
            dialog.setTitle("Modifications à enregistrer")
            dialog.setPositiveButton("Réessayer l’enregistrement") { _, _ ->
                currentToken = ""; authorizationStarted = false; pendingAuthorization = null
                authorizeSelectedAccount()
            }
            dialog.setNeutralButton("Sauvegarder une copie") { _, _ ->
                val file = localPdf ?: return@setNeutralButton
                val uri = FileProvider.getUriForFile(this, "$packageName.updatefiles", file)
                val send = Intent(Intent.ACTION_SEND).setType(documentMime).putExtra(Intent.EXTRA_STREAM, uri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                send.clipData = ClipData.newRawUri(file.name, uri)
                try { startActivity(Intent.createChooser(send, "Sauvegarder le document")) }
                catch (_: Exception) { fail("Aucune application disponible pour sauvegarder la copie.") }
            }
        } else {
            dialog.setPositiveButton("Réessayer") { _, _ ->
                currentToken = ""; authorizationStarted = false; pendingAuthorization = null
                if (sessionEmail.isBlank()) prepareAccount() else {
                    authorizeSelectedAccount()
                    if (selectedReader == null) chooseReaderBeforeDownload()
                }
            }
            if (allowDrive) dialog.setNeutralButton("Ouvrir dans Drive") { _, _ ->
                val uri = Uri.parse("https://drive.google.com/file/d/" + Uri.encode(fileId) + "/view?authuser=" + Uri.encode(sessionEmail))
                val drive = Intent(Intent.ACTION_VIEW, uri).setPackage("com.google.android.apps.docs")
                    .putExtra("authAccount", sessionEmail)
                try { startActivity(drive); finish() }
                catch (_: Exception) { fail("Google Drive n’est pas installé. L’autorisation Android doit être corrigée pour utiliser le lecteur choisi.") }
            }
        }
        dialog.show()
    }

    override fun onDestroy() {
        statusDialog?.dismiss()
        readerDialog?.dismiss()
        executor.shutdownNow()
        super.onDestroy()
    }
}
