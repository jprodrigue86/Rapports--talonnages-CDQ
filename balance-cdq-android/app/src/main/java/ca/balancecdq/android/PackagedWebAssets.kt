package ca.balancecdq.android

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceResponse
import org.json.JSONObject
import java.io.ByteArrayInputStream

/** Only explicitly packaged, public application resources are served locally. */
class PackagedWebAssets(context: Context) {
    companion object {
        const val ROOT = "/Rapports--talonnages-CDQ/"
        const val HOST = "jprodrigue86.github.io"
    }

    private val appContext = context.applicationContext
    private val installedVersion = appContext.packageManager
        .getPackageInfo(appContext.packageName, 0)
        .versionName
        .orEmpty()
        .trim()
        .also { require(it.matches(Regex("^\\d+\\.\\d+$"))) }

    val prefix: String = ROOT + "native/v" + installedVersion + "/"
    val startUrl: String = "https://" + HOST + prefix + "index.html"

    private val assets = appContext.assets
    private val entries = JSONObject(assets.open("cdq-web/asset-manifest.json").bufferedReader().use { it.readText() }).getJSONObject("files")

    fun intercept(uri: Uri, method: String = "GET"): WebResourceResponse? {
        if (method != "GET" || uri.scheme != "https" || uri.host != HOST || uri.port !in listOf(-1, 443)) return null
        val path = uri.path ?: return null
        val reserved = path.startsWith(prefix)
        if (!reserved && !path.startsWith(ROOT)) return null
        val relative = path.removePrefix(if (reserved) prefix else ROOT).ifEmpty { "index.html" }
        if (relative.split('/').any { it == "." || it == ".." } || relative.contains('\\')) return missing()
        if (!entries.has(relative)) return if (reserved) missing() else null
        // Mutable update metadata and server responses are never in this manifest.
        val info = entries.getJSONObject(relative)
        val mime = if (relative == "bundles/balance-cdq/v25.14/icons-reference.png")
            "image/jpeg"
        else info.getString("mime")
        return WebResourceResponse(mime, if (info.optBoolean("text")) "UTF-8" else null,
            200, "OK", mapOf("Cache-Control" to "no-store", "Access-Control-Allow-Origin" to "https://$HOST", "X-Content-Type-Options" to "nosniff"),
            assets.open("cdq-web/$relative"))
    }

    private fun missing() = WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
        mapOf("Cache-Control" to "no-store"), ByteArrayInputStream("Ressource CDQ absente de cette installation.".toByteArray()))
}
