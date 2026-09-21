package ca.balancecdq.android

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast

class MainActivity : Activity() {
    companion object {
        private const val REQ_FILE_CHOOSER = 25030
        private const val APP_URL =
            "https://jprodrigue86.github.io/Rapports--talonnages-CDQ/?source=balance-cdq-android&native=25.03"
    }

    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(5, 12, 20))
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false

            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.loadsImagesAutomatically = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.javaScriptCanOpenWindowsAutomatically = true
            settings.setSupportMultipleWindows(false)
            settings.mediaPlaybackRequiresUserGesture = false
            settings.userAgentString =
                settings.userAgentString + " BalanceCDQAndroid/25.03"

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    if (!request.isForMainFrame) return false
                    return handleNavigation(request.url.toString())
                }

                @Deprecated("Legacy WebView callback")
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    url: String
                ): Boolean = handleNavigation(url)
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    newCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = newCallback

                    return try {
                        val intent = fileChooserParams?.createIntent()
                            ?: Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                                addCategory(Intent.CATEGORY_OPENABLE)
                                type = "*/*"
                            }

                        startActivityForResult(
                            Intent.createChooser(intent, "Choisir un fichier"),
                            REQ_FILE_CHOOSER
                        )
                        true
                    } catch (_: ActivityNotFoundException) {
                        fileCallback = null
                        Toast.makeText(
                            this@MainActivity,
                            "Aucune application ne peut choisir ce fichier.",
                            Toast.LENGTH_LONG
                        ).show()
                        false
                    }
                }
            }
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        setContentView(webView)

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    private fun handleNavigation(url: String): Boolean {
        return try {
            when {
                url.startsWith("intent://", ignoreCase = true) -> {
                    val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                    val fallback = intent.getStringExtra("browser_fallback_url")
                    intent.removeExtra("browser_fallback_url")

                    try {
                        startActivity(intent)
                    } catch (_: ActivityNotFoundException) {
                        if (!fallback.isNullOrBlank()) {
                            webView.loadUrl(fallback)
                        } else {
                            Toast.makeText(
                                this,
                                "Application Android requise introuvable.",
                                Toast.LENGTH_LONG
                            ).show()
                        }
                    }
                    true
                }

                url.startsWith("cdqpdf://", true) ||
                    url.startsWith("cdqsheet://", true) ||
                    url.startsWith("cdqupdate://", true) ||
                    url.startsWith("cdqaccount://", true) ||
                    url.startsWith("cdqapp://", true) -> {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    true
                }

                url.startsWith("mailto:", true) ||
                    url.startsWith("sms:", true) ||
                    url.startsWith("tel:", true) ||
                    url.startsWith("market:", true) -> {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    true
                }

                else -> false
            }
        } catch (e: Exception) {
            Toast.makeText(
                this,
                e.message ?: "Impossible d’ouvrir cette action.",
                Toast.LENGTH_LONG
            ).show()
            true
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQ_FILE_CHOOSER) {
            val result = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            fileCallback?.onReceiveValue(result)
            fileCallback = null
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Android back callback")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.removeAllViews()
            webView.destroy()
        }
        super.onDestroy()
    }
}
