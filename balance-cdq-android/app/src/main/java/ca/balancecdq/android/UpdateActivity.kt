package ca.balancecdq.android

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

class UpdateActivity : Activity() {
    companion object {
        private const val MANIFEST_URL =
            "https://jprodrigue86.github.io/Rapports--talonnages-CDQ/downloads/android-update.json"
    }

    private val executor = Executors.newSingleThreadExecutor()

    private lateinit var status: TextView
    private lateinit var progress: ProgressBar
    private lateinit var action: Button

    private var downloadedApk: File? = null
    private var latestVersionName = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        checkUpdate()
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(36), dp(24), dp(28))
            setBackgroundColor(Color.rgb(5, 12, 20))
        }

        val title = TextView(this).apply {
            text = "Mise à jour Balance CDQ Android"
            setTextColor(Color.WHITE)
            textSize = 22f
            gravity = Gravity.CENTER
        }
        root.addView(title, fullWidth())

        status = TextView(this).apply {
            text = "Vérification de la dernière version…"
            setTextColor(Color.rgb(180, 213, 230))
            textSize = 15f
            gravity = Gravity.CENTER
            setPadding(0, dp(24), 0, dp(18))
        }
        root.addView(status, fullWidth())

        progress = ProgressBar(this).apply {
            isIndeterminate = true
        }
        root.addView(progress)

        action = Button(this).apply {
            text = "Mettre à jour"
            isEnabled = false
            setAllCaps(false)
            setOnClickListener { beginInstallFlow() }
        }
        val ap = fullWidth()
        ap.topMargin = dp(22)
        root.addView(action, ap)

        val close = Button(this).apply {
            text = "Fermer"
            setAllCaps(false)
            setOnClickListener { finish() }
        }
        val cp = fullWidth()
        cp.topMargin = dp(10)
        root.addView(close, cp)

        setContentView(root)
    }

    private fun checkUpdate() {
        progress.visibility = ProgressBar.VISIBLE
        action.isEnabled = false

        executor.execute {
            try {
                val json = fetchJson(MANIFEST_URL)
                val latestCode = json.getInt("versionCode")
                latestVersionName = json.optString("versionName", latestCode.toString())
                val apkUrl = json.getString("apkUrl")
                val sha256 = json.getString("sha256").lowercase()

                runOnUiThread {
                    if (latestCode.toLong() <= currentVersionCode()) {
                        progress.visibility = ProgressBar.GONE
                        status.text =
                            "Balance CDQ Android est à jour.\nVersion installée : ${currentVersionName()}"
                        action.isEnabled = false
                    } else {
                        status.text =
                            "Nouvelle version disponible : $latestVersionName\n" +
                            "Version installée : ${currentVersionName()}\n\n" +
                            "Préparation de la mise à jour…"
                    }
                }

                if (latestCode.toLong() > currentVersionCode()) {
                    val apk = downloadApk(apkUrl)
                    val actual = sha256(apk)
                    if (!actual.equals(sha256, ignoreCase = true)) {
                        apk.delete()
                        throw IllegalStateException("La vérification de sécurité de l’APK a échoué.")
                    }

                    downloadedApk = apk
                    runOnUiThread {
                        progress.visibility = ProgressBar.GONE
                        status.text =
                            "Balance CDQ Android $latestVersionName est prête.\n" +
                            "Touchez « Mettre à jour »."
                        action.isEnabled = true
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    progress.visibility = ProgressBar.GONE
                    status.text = e.message ?: "Impossible de vérifier la mise à jour Android."
                    action.isEnabled = false
                }
            }
        }
    }

    private fun beginInstallFlow() {
        val apk = downloadedApk ?: return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !packageManager.canRequestPackageInstalls()
        ) {
            Toast.makeText(
                this,
                "Autorisez une seule fois Balance CDQ à installer ses propres mises à jour.",
                Toast.LENGTH_LONG
            ).show()

            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:$packageName")
            )
            startActivity(intent)
            return
        }

        installApk(apk)
    }

    override fun onResume() {
        super.onResume()
        val apk = downloadedApk ?: return

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            packageManager.canRequestPackageInstalls()
        ) {
            if (action.isEnabled) {
                installApk(apk)
            }
        }
    }

    private fun installApk(apk: File) {
        try {
            val uri = FileProvider.getUriForFile(
                this,
                "$packageName.updatefiles",
                apk
            )

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(
                this,
                e.message ?: "Impossible de lancer l’installation.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun fetchJson(url: String): JSONObject {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 12000
        conn.readTimeout = 12000
        conn.setRequestProperty("Cache-Control", "no-cache")
        return try {
            if (conn.responseCode !in 200..299) {
                throw IllegalStateException("Serveur de mise à jour indisponible (${conn.responseCode}).")
            }
            JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
        } finally {
            conn.disconnect()
        }
    }

    private fun downloadApk(url: String): File {
        val dir = File(cacheDir, "updates").apply { mkdirs() }
        val out = File(dir, "Balance-CDQ-Android-update.apk")
        if (out.exists()) out.delete()

        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 15000
        conn.readTimeout = 60000
        conn.instanceFollowRedirects = true

        try {
            if (conn.responseCode !in 200..299) {
                throw IllegalStateException("Téléchargement de la mise à jour impossible (${conn.responseCode}).")
            }

            val total = conn.contentLengthLong
            conn.inputStream.use { input ->
                out.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    var read: Int
                    var done = 0L
                    while (input.read(buffer).also { read = it } >= 0) {
                        if (read == 0) continue
                        output.write(buffer, 0, read)
                        done += read

                        if (total > 0L) {
                            val pct = ((done * 100L) / total).toInt().coerceIn(0, 100)
                            runOnUiThread {
                                status.text =
                                    "Téléchargement Balance CDQ Android $latestVersionName… $pct %"
                            }
                        }
                    }
                }
            }
            return out
        } finally {
            conn.disconnect()
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            var read: Int
            while (input.read(buffer).also { read = it } >= 0) {
                if (read > 0) digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun currentVersionCode(): Long {
        val info = packageManager.getPackageInfo(packageName, 0)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            info.versionCode.toLong()
        }
    }

    private fun currentVersionName(): String {
        val info = packageManager.getPackageInfo(packageName, 0)
        return info.versionName.orEmpty().ifBlank { currentVersionCode().toString() }
    }

    private fun fullWidth(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }
}
