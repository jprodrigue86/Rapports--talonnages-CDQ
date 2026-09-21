package ca.balancecdq.android

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File

class AppShareActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handle(intent)
    }

    override fun onNewIntent(newIntent: Intent?) {
        super.onNewIntent(newIntent)
        if (newIntent == null) return
        intent = newIntent
        handle(newIntent)
    }

    private fun handle(source: Intent) {
        when (source.data?.host?.lowercase()) {
            "share" -> shareOwnApk()
            "reinstall" -> reinstallOwnApk()
            else -> {
                Toast.makeText(this, "Commande APK inconnue.", Toast.LENGTH_SHORT).show()
                finish()
            }
        }
    }

    private fun currentApkCopy(): Pair<File, Uri> {
        val source = File(applicationInfo.sourceDir)
        if (!source.isFile || source.length() < 1024L) {
            throw IllegalStateException("APK Balance CDQ introuvable.")
        }

        val dir = File(cacheDir, "updates").apply { mkdirs() }
        val out = File(dir, "Balance-CDQ-Android-25.02.apk")

        if (!out.isFile || out.length() != source.length()) {
            if (out.exists()) out.delete()
            source.inputStream().buffered(256 * 1024).use { input ->
                out.outputStream().buffered(256 * 1024).use { output ->
                    input.copyTo(output, 256 * 1024)
                }
            }
        }

        val uri = FileProvider.getUriForFile(
            this,
            "$packageName.updatefiles",
            out
        )

        return out to uri
    }

    private fun shareOwnApk() {
        try {
            val (_, uri) = currentApkCopy()

            val send = Intent(Intent.ACTION_SEND).apply {
                type = "application/vnd.android.package-archive"
                putExtra(Intent.EXTRA_SUBJECT, "Balance CDQ Android 25.02")
                putExtra(
                    Intent.EXTRA_TEXT,
                    "Application Balance CDQ Android 25.02"
                )
                putExtra(Intent.EXTRA_STREAM, uri)
                clipData = ClipData.newRawUri("Balance CDQ Android", uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(
                send,
                "Partager l’application Balance CDQ"
            ).apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            startActivity(chooser)
        } catch (e: Exception) {
            Toast.makeText(
                this,
                e.message ?: "Impossible de partager l’APK Balance CDQ.",
                Toast.LENGTH_LONG
            ).show()
            finish()
        }
    }

    private fun reinstallOwnApk() {
        try {
            val (_, uri) = currentApkCopy()

            val install = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                clipData = ClipData.newRawUri("Balance CDQ Android", uri)
            }

            startActivity(install)
            finish()
        } catch (e: Exception) {
            Toast.makeText(
                this,
                e.message ?: "Impossible de lancer la réinstallation.",
                Toast.LENGTH_LONG
            ).show()
            finish()
        }
    }
}
