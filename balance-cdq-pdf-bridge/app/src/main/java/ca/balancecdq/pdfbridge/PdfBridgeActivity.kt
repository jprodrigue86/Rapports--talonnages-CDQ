package ca.balancecdq.pdfbridge

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

class PdfBridgeActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var title: TextView
    private lateinit var detail: TextView
    private lateinit var progress: ProgressBar
    private lateinit var percent: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        handleIntent(intent)
    }

    override fun onNewIntent(newIntent: Intent?) {
        super.onNewIntent(newIntent)
        if (newIntent != null) {
            intent = newIntent
            handleIntent(newIntent)
        }
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(54, 54, 54, 54)
            setBackgroundColor(Color.rgb(5, 12, 20))
        }

        title = TextView(this).apply {
            text = "Balance CDQ"
            setTextColor(Color.WHITE)
            textSize = 22f
            gravity = Gravity.CENTER
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        root.addView(title, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ))

        detail = TextView(this).apply {
            text = "Préparation du PDF…"
            setTextColor(Color.rgb(174, 203, 220))
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(0, 18, 0, 18)
        }
        root.addView(detail)

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = 0
        }
        root.addView(progress, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            22
        ))

        percent = TextView(this).apply {
            text = "0 %"
            setTextColor(Color.rgb(80, 218, 255))
            textSize = 13f
            gravity = Gravity.CENTER
            setPadding(0, 12, 0, 0)
        }
        root.addView(percent)

        setContentView(root)
    }

    private fun handleIntent(incoming: Intent) {
        if (incoming.data?.scheme != "cdqpdf") {
            showError("Demande PDF invalide.")
            return
        }

        val fileId = incoming.getStringExtra("fileId").orEmpty()
        val fileName = incoming.getStringExtra("fileName").orEmpty().ifBlank { "Rapport.pdf" }
        val reader = incoming.getStringExtra("reader").orEmpty().ifBlank { "ask" }
        val token = incoming.getStringExtra("accessToken").orEmpty()
        val version = incoming.getStringExtra("version").orEmpty()

        if (!fileId.matches(Regex("^[A-Za-z0-9_-]{10,200}$")) || token.length < 20) {
            showError("Compte Google ou fichier invalide.")
            return
        }

        title.text = fileName
        executor.execute {
            try {
                val file = cachedFile(fileId, fileName, version)
                if (!file.exists() || file.length() < 5L) {
                    downloadPdf(fileId, token, file)
                } else {
                    updateProgress(100, "PDF déjà prêt sur cet appareil.")
                }
                runOnUiThread { openPdf(file, reader) }
            } catch (e: Exception) {
                runOnUiThread { showError(e.message ?: "Impossible d’ouvrir le PDF.") }
            }
        }
    }

    private fun cachedFile(fileId: String, fileName: String, version: String): File {
        val dir = File(cacheDir, "pdfs").apply { mkdirs() }
        val safeName = fileName.replace(Regex("[^A-Za-z0-9._ -]"), "_").take(90)
        val key = sha256("$fileId|$version").take(16)
        return File(dir, "$key-$safeName")
    }

    private fun downloadPdf(fileId: String, token: String, outFile: File) {
        updateProgress(2, "Connexion directe à Google Drive…")
        val url = URL("https://www.googleapis.com/drive/v3/files/" +
            Uri.encode(fileId) + "?alt=media&supportsAllDrives=true")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15000
            readTimeout = 45000
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Accept", "application/pdf")
        }

        val code = conn.responseCode
        if (code !in 200..299) {
            val message = try {
                conn.errorStream?.bufferedReader()?.use { it.readText() }
            } catch (_: Exception) { null }
            conn.disconnect()
            throw IllegalStateException("Google Drive a refusé le PDF ($code)." +
                if (!message.isNullOrBlank()) " $message" else "")
        }

        val total = conn.contentLengthLong.coerceAtLeast(0L)
        val temp = File(outFile.parentFile, outFile.name + ".part")
        if (temp.exists()) temp.delete()

        conn.inputStream.use { input ->
            FileOutputStream(temp).use { output ->
                val buffer = ByteArray(128 * 1024)
                var downloaded = 0L
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    output.write(buffer, 0, count)
                    downloaded += count
                    val pct = if (total > 0L) {
                        (3 + (downloaded * 94L / total)).toInt().coerceIn(3, 97)
                    } else 50
                    updateProgress(
                        pct,
                        if (total > 0L)
                            "Téléchargement Drive · ${downloaded / 1024 / 1024} / ${total / 1024 / 1024} Mo"
                        else
                            "Téléchargement direct depuis Drive…"
                    )
                }
            }
        }
        conn.disconnect()

        if (temp.length() < 5L) throw IllegalStateException("Le PDF reçu est vide.")
        temp.inputStream().use {
            val head = ByteArray(5)
            if (it.read(head) != 5 || String(head, Charsets.US_ASCII) != "%PDF-") {
                temp.delete()
                throw IllegalStateException("Le fichier reçu n’est pas un PDF valide.")
            }
        }

        if (outFile.exists()) outFile.delete()
        if (!temp.renameTo(outFile)) {
            temp.copyTo(outFile, overwrite = true)
            temp.delete()
        }
        updateProgress(100, "PDF prêt.")
    }

    private fun openPdf(file: File, reader: String) {
        val uri = FileProvider.getUriForFile(
            this,
            "${packageName}.files",
            file
        )

        val base = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            clipData = ClipData.newRawUri("PDF", uri)
        }

        val targetPackage = when (reader.lowercase()) {
            "ilovepdf" -> "com.ilovepdf.www"
            "acrobat" -> "com.adobe.reader"
            else -> ""
        }

        if (targetPackage.isNotBlank()) {
            val targeted = Intent(base).apply { setPackage(targetPackage) }
            if (targeted.resolveActivity(packageManager) != null) {
                startActivity(targeted)
                finish()
                return
            }
        }

        try {
            startActivity(Intent.createChooser(base, "Ouvrir le PDF avec"))
            finish()
        } catch (_: ActivityNotFoundException) {
            showError("Aucun lecteur PDF compatible n’est installé.")
        }
    }

    private fun updateProgress(value: Int, message: String) {
        runOnUiThread {
            progress.progress = value.coerceIn(0, 100)
            percent.text = "${value.coerceIn(0, 100)} %"
            detail.text = message
        }
    }

    private fun showError(message: String) {
        detail.text = message
        detail.setTextColor(Color.rgb(255, 120, 130))
        progress.progress = 0
        percent.text = ""
    }

    private fun sha256(text: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(text.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }
}
