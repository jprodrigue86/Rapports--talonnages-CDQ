package ca.balancecdq.android

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Reads the durable Android release channel without trusting one cache/CDN path. */
internal object AndroidUpdateChannel {
    private val manifestUrls = listOf(
        "https://raw.githubusercontent.com/jprodrigue86/Rapports--talonnages-CDQ/main/downloads/android-release-update.json",
        "https://jprodrigue86.github.io/Rapports--talonnages-CDQ/downloads/android-release-update.json"
    )

    fun fetchLatest(connectTimeoutMs: Int = 12_000, readTimeoutMs: Int = 12_000): JSONObject {
        val candidates = mutableListOf<JSONObject>()
        var lastError: Exception? = null
        for (base in manifestUrls) {
            try {
                val separator = if (base.contains("?")) "&" else "?"
                val url = base + separator + "cdq_ts=" + System.currentTimeMillis()
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = connectTimeoutMs
                conn.readTimeout = readTimeoutMs
                conn.instanceFollowRedirects = true
                conn.useCaches = false
                conn.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0")
                conn.setRequestProperty("Pragma", "no-cache")
                try {
                    if (conn.responseCode !in 200..299) {
                        throw IllegalStateException("Serveur de mise à jour indisponible (${conn.responseCode}).")
                    }
                    val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
                    if (json.optLong("versionCode", 0L) > 0L &&
                        json.optString("versionName").isNotBlank() &&
                        json.optString("apkUrl").isNotBlank()
                    ) candidates += json
                } finally {
                    conn.disconnect()
                }
            } catch (e: Exception) {
                lastError = e
            }
        }
        if (candidates.isEmpty()) throw (lastError ?: IllegalStateException("Canal Android indisponible."))
        return candidates.maxByOrNull { it.optLong("versionCode", 0L) }!!
    }
}
