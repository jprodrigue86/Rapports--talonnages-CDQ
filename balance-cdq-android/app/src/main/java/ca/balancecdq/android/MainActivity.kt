package ca.balancecdq.android

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal
import android.os.SystemClock
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceResponse
import android.webkit.ServiceWorkerClient
import android.webkit.ServiceWorkerController
import android.widget.Toast
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors

class MainActivity : Activity() {
    companion object {
        private const val REQ_FILE_CHOOSER = 25050
        private const val APP_URL = PackagedWebAssets.START_URL
        private const val AUTH_URL =
            "https://jprodrigue86.github.io/Rapports--talonnages-CDQ/android-auth.html"
        private const val UPDATE_MANIFEST_URL =
            "https://raw.githubusercontent.com/jprodrigue86/Rapports--talonnages-CDQ/main/downloads/android-release-update.json"
    }

    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private var googleChallengeId = ""
    private var googleNonce = ""
    private var googleClientId = ""

    private var biometricCancellation: CancellationSignal? = null
    private var biometricRequestId = ""
    private val startupTicketStore by lazy { StartupTicketStore(this) }
    private var startupGrantRequestId = ""
    private var startupGrantSecret = ""
    private var startupGrantUntilElapsed = 0L
    @Volatile private var startupRemoteLocked = false
    private var earlyBiometricRequestId = ""
    private var earlyBiometricSuccess: Boolean? = null
    private var earlyBiometricMessage = ""
    private var earlyBiometricGrant = ""

    private val startupUpdateExecutor = Executors.newSingleThreadExecutor()
    @Volatile private var startupUpdateStarted = false

    inner class NativeBridge {
        @JavascriptInterface
        fun openSheet(fileId: String?, account: String?, readOnly: Boolean) {
            if (startupRemoteLocked) {
                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "Validation sécurisée en arrière-plan. Google Sheets sera disponible dans un instant.",
                        Toast.LENGTH_SHORT
                    ).show()
                }
                return
            }
            val id = fileId.orEmpty()
            if (!id.matches(Regex("^[A-Za-z0-9_-]{10,200}$"))) return
            val email = account.orEmpty().trim().take(320)
            runOnUiThread {
                val uri = Uri.parse("cdqsheet://open").buildUpon()
                    .appendQueryParameter("fileId", id)
                    .appendQueryParameter("account", email)
                    .appendQueryParameter("accountMode", if (email.isBlank()) "auto" else "default")
                    .appendQueryParameter("readOnly", if (readOnly) "1" else "0").build()
                startActivity(Intent(this@MainActivity, SheetOpenActivity::class.java).setData(uri))
            }
        }

        @JavascriptInterface
        fun loginGoogle(challengeId: String?, nonce: String?, clientId: String?) {
            val challenge = challengeId.orEmpty().trim()
            val n = nonce.orEmpty().trim()
            val client = clientId.orEmpty().trim()

            if (!challenge.matches(Regex("^[A-Za-z0-9._-]{8,220}$")) ||
                n.length !in 8..500 ||
                !client.matches(Regex("^[0-9A-Za-z._-]+\\.apps\\.googleusercontent\\.com$"))
            ) {
                nativeGoogleError("Demande Google invalide.")
                return
            }

            runOnUiThread {
                openWebGoogleLogin(challenge, n, client)
            }
        }

        @JavascriptInterface
        fun startupBiometricState(account: String?, deviceToken: String?): String {
            val id = earlyBiometricRequestId
            if (id.isBlank()) return """{"state":"none"}"""
            val ticket = startupTicketStore.read(
                account.orEmpty(),
                deviceToken.orEmpty()
            ) ?: return """{"state":"none"}"""
            val state = when (earlyBiometricSuccess) {
                null -> "pending"
                true -> "success"
                false -> "failure"
            }
            return JSONObject()
                .put("state", state)
                .put("requestId", id)
                .put("email", ticket.email)
                .put("expiresAt", ticket.expiresAt)
                .put("message", earlyBiometricMessage)
                .put("grant", if (earlyBiometricSuccess == true) earlyBiometricGrant else "")
                .toString()
        }

        @JavascriptInterface
        fun localStartupTicket(
            requestId: String?,
            grant: String?,
            account: String?,
            deviceToken: String?
        ): String {
            if (!validStartupGrant(requestId, grant)) return """{"ok":false}"""
            val ticket = startupTicketStore.read(
                account.orEmpty(),
                deviceToken.orEmpty()
            ) ?: return """{"ok":false}"""
            startupRemoteLocked = true
            return JSONObject()
                .put("ok", true)
                .put("email", ticket.email)
                .put("expiresAt", ticket.expiresAt)
                .toString()
        }

        @JavascriptInterface
        fun confirmStartupTicket(
            requestId: String?,
            grant: String?,
            account: String?,
            deviceToken: String?
        ): Boolean {
            if (!validStartupGrant(requestId, grant)) return false
            val saved = startupTicketStore.save(
                account.orEmpty(),
                deviceToken.orEmpty()
            )
            if (saved) {
                startupRemoteLocked = false
                clearStartupGrant()
            }
            return saved
        }

        @JavascriptInterface
        fun clearStartupTicket(requestId: String?, grant: String?) {
            if (!validStartupGrant(requestId, grant)) return
            startupTicketStore.clear()
            startupRemoteLocked = false
            clearStartupGrant()
        }

        @JavascriptInterface
        fun biometric(requestId: String?) {
            val id = requestId.orEmpty().trim()
            if (!id.matches(Regex("^[A-Za-z0-9._-]{1,120}$"))) return
            runOnUiThread { startNativeBiometric(id) }
        }

        @JavascriptInterface
        fun cancelBiometric(requestId: String?) {
            val id = requestId.orEmpty().trim()
            runOnUiThread {
                if (id.isBlank() || biometricRequestId == id) {
                    biometricRequestId = ""
                    biometricCancellation?.cancel()
                    biometricCancellation = null
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.Theme_BalanceCDQ)
        super.onCreate(savedInstanceState)

        val packagedAssets = PackagedWebAssets(this)
        // An older PWA worker may still control this origin after an APK update.
        ServiceWorkerController.getInstance().setServiceWorkerClient(object : ServiceWorkerClient() {
            override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? =
                packagedAssets.intercept(request.url, request.method)
        })

        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false

            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = false
            settings.textZoom = 100
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
                settings.userAgentString + " BalanceCDQAndroid/25.39 CDQSafeArea/1"

            addJavascriptInterface(NativeBridge(), "BalanceCDQNative")

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    packagedAssets.intercept(request.url, request.method)

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    if (!request.isForMainFrame) {
                        val uri = request.url.toString()
                        val internal = uri.startsWith("cdqpdf://open?") ||
                            uri.startsWith("cdqsheet://open?") ||
                            uri.startsWith("cdqnote://open?") ||
                            (uri.startsWith("intent://open?") &&
                                uri.contains("package=ca.balancecdq.android;"))
                        if (!internal || !request.hasGesture()) return false
                    }
                    return handleNavigation(request.url.toString())
                }

                @Deprecated("Legacy WebView callback")
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    url: String
                ): Boolean = handleNavigation(url)

                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    if (url.startsWith("https://jprodrigue86.github.io/Rapports--talonnages-CDQ/")) {
                        installGoogleBridge()
                    }
                }
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
                        val chooserIntent = fileChooserParams?.createIntent()
                            ?: Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                                addCategory(Intent.CATEGORY_OPENABLE)
                                type = "*/*"
                            }

                        startActivityForResult(
                            Intent.createChooser(chooserIntent, "Choisir un fichier"),
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

        setContentView(SafeContentInsets.host(this, webView))

        // Always run the tiny packaged startup shell. Restoring an old WebView
        // can skip the fast biometric bootstrap and reintroduce the slow path.
        maybeStartEarlyBiometric()
        webView.loadUrl(APP_URL)
        checkForNativeUpdateOnLaunch()

        handleAuthCallback(intent)
    }

    override fun onNewIntent(newIntent: Intent?) {
        super.onNewIntent(newIntent)
        if (newIntent == null) return
        intent = newIntent
        handleAuthCallback(newIntent)
    }

    private fun installGoogleBridge() {
        val script = """
            (function(){
              if(window.__cdqNativeGoogleV2506)return;
              window.__cdqNativeGoogleV2506=true;

              function ui(){
                try{
                  var container=document.getElementById('google-button-container');
                  if(container){
                    container.innerHTML='';
                    container.style.display='none';
                    container.style.minHeight='0';
                  }
                  var fallback=document.getElementById('google-touch-fallback');
                  if(fallback){
                    fallback.hidden=false;
                    fallback.disabled=false;
                    fallback.textContent='Continuer avec Google';
                  }
                  var help=document.getElementById('google-touch-help');
                  if(help){
                    help.hidden=false;
                    help.textContent='Connexion Google sécurisée. Retour automatique dans Balance CDQ.';
                  }
                }catch(e){}
              }

              function start(){
                try{
                  if(typeof cdqGoogleChallengeV42==='undefined' ||
                     !cdqGoogleChallengeV42 ||
                     !cdqGoogleChallengeV42.challengeId ||
                     !cdqGoogleChallengeV42.clientId){
                    if(typeof selectorWindow!=='undefined' && selectorWindow &&
                       typeof replyToSelector==='function'){
                      replyToSelector(selectorWindow,{
                        type:'CDQ_GOOGLE_AUTH_RETRY',
                        authProtocol:42
                      });
                    }
                    return;
                  }

                  ui();
                  BalanceCDQNative.loginGoogle(
                    String(cdqGoogleChallengeV42.challengeId||''),
                    String(cdqGoogleChallengeV42.nonce||''),
                    String(cdqGoogleChallengeV42.clientId||'')
                  );
                }catch(e){
                  var m=document.getElementById('load-message');
                  if(m)m.textContent='Impossible de démarrer la connexion Google.';
                }
              }

              var originalShow=window.afficherConnexionGoogleV42;
              if(typeof originalShow==='function'){
                window.afficherConnexionGoogleV42=async function(){
                  var result=await originalShow.apply(this,arguments);
                  ui();
                  setTimeout(ui,80);
                  return result;
                };
              }

              var fallback=document.getElementById('google-touch-fallback');
              if(fallback && !fallback.dataset.cdqNative2506){
                fallback.dataset.cdqNative2506='1';
                fallback.addEventListener('click',function(e){
                  e.preventDefault();
                  e.stopImmediatePropagation();
                  start();
                },true);
              }

              window.cdqNativeGoogleCredentialV2506=function(token,challengeId){
                try{
                  if(typeof cdqGoogleChallengeV42==='undefined' ||
                     !cdqGoogleChallengeV42 ||
                     String(cdqGoogleChallengeV42.challengeId||'')!==String(challengeId||'')){
                    return;
                  }
                  if(typeof envoyerCredentialGoogleV42==='function'){
                    envoyerCredentialGoogleV42({credential:String(token||'')});
                  }
                }catch(e){
                  var m=document.getElementById('load-message');
                  if(m)m.textContent='Le retour Google n’a pas pu être validé.';
                }
              };

              window.cdqNativeGoogleErrorV2506=function(message){
                try{
                  var m=document.getElementById('load-message');
                  if(m)m.textContent=String(message||'Connexion Google annulée.');
                  var fallback=document.getElementById('google-touch-fallback');
                  if(fallback){
                    fallback.hidden=false;
                    fallback.disabled=false;
                    fallback.textContent='Continuer avec Google';
                  }
                }catch(e){}
              };

              ui();
              setTimeout(ui,250);
            })();
        """.trimIndent()

        webView.evaluateJavascript(script, null)
    }

    private fun maybeStartEarlyBiometric() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return
        if (startupTicketStore.peek() == null) return
        val id = "native-startup-" + UUID.randomUUID().toString()
        earlyBiometricRequestId = id
        earlyBiometricSuccess = null
        earlyBiometricMessage = ""
        earlyBiometricGrant = ""
        startNativeBiometric(id)
    }

    private fun validStartupGrant(requestId: String?, grant: String?): Boolean {
        val id = requestId.orEmpty()
        val secret = grant.orEmpty()
        return id.isNotBlank() &&
            secret.length in 20..120 &&
            id == startupGrantRequestId &&
            secret == startupGrantSecret &&
            SystemClock.elapsedRealtime() < startupGrantUntilElapsed
    }

    private fun clearStartupGrant() {
        startupGrantRequestId = ""
        startupGrantSecret = ""
        startupGrantUntilElapsed = 0L
    }

    @Suppress("DEPRECATION")
    private fun startNativeBiometric(requestId: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            biometricRequestId = requestId
            deliverNativeBiometric(requestId, false, "Biométrie Android indisponible.")
            return
        }

        biometricCancellation?.cancel()
        biometricRequestId = requestId
        val signal = CancellationSignal()
        biometricCancellation = signal
        val executor = mainExecutor

        val prompt = BiometricPrompt.Builder(this)
            .setTitle("Balance CDQ")
            .setSubtitle("Confirmez votre identité")
            .setNegativeButton("Utiliser le NIP", executor) { _, _ ->
                deliverNativeBiometric(requestId, false, "Utilisez votre NIP.")
            }
            .build()

        prompt.authenticate(
            signal,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult?) {
                    super.onAuthenticationSucceeded(result)
                    deliverNativeBiometric(requestId, true, "")
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence?) {
                    super.onAuthenticationError(errorCode, errString)
                    deliverNativeBiometric(
                        requestId,
                        false,
                        errString?.toString().orEmpty().ifBlank { "Biométrie annulée." }
                    )
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    // Android garde la boîte biométrique ouverte pour une autre tentative.
                }
            }
        )
    }

    private fun deliverNativeBiometric(requestId: String, success: Boolean, message: String) {
        if (biometricRequestId != requestId) return
        biometricRequestId = ""
        biometricCancellation = null

        val grant = if (success) UUID.randomUUID().toString() else ""
        if (success) {
            startupGrantRequestId = requestId
            startupGrantSecret = grant
            startupGrantUntilElapsed = SystemClock.elapsedRealtime() + 90_000L
        } else {
            clearStartupGrant()
            startupRemoteLocked = false
        }

        val early = requestId == earlyBiometricRequestId
        if (early) {
            earlyBiometricSuccess = success
            earlyBiometricMessage = message
            earlyBiometricGrant = grant
        }

        if (!::webView.isInitialized) return
        val idQuoted = JSONObject.quote(requestId)
        val messageQuoted = JSONObject.quote(message)
        val grantQuoted = JSONObject.quote(grant)
        val callback = if (early) "window.cdqNativeStartupBiometricResultV2539"
            else "window.cdqNativeBiometricResultV2507"
        webView.evaluateJavascript(
            "$callback && $callback($idQuoted,$success,$messageQuoted,$grantQuoted);",
            null
        )
    }

    private fun openWebGoogleLogin(
        challengeId: String,
        nonce: String,
        clientId: String
    ) {
        googleChallengeId = challengeId
        googleNonce = nonce
        googleClientId = clientId

        val uri = Uri.parse(AUTH_URL).buildUpon()
            .appendQueryParameter("challengeId", challengeId)
            .appendQueryParameter("nonce", nonce)
            .appendQueryParameter("clientId", clientId)
            .build()

        val colors = CustomTabColorSchemeParams.Builder()
            .setToolbarColor(Color.BLACK)
            .setNavigationBarColor(Color.BLACK)
            .build()

        val tab = CustomTabsIntent.Builder()
            .setDefaultColorSchemeParams(colors)
            .setShowTitle(false)
            .setUrlBarHidingEnabled(true)
            .build()

        try {
            if (isInstalled("com.android.chrome")) {
                tab.intent.setPackage("com.android.chrome")
            }
            tab.launchUrl(this, uri)
        } catch (_: Exception) {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        }
    }

    private fun handleAuthCallback(source: Intent?) {
        val data = source?.data ?: return
        if (!data.scheme.equals("cdqauth", ignoreCase = true) ||
            !data.host.equals("callback", ignoreCase = true)
        ) return

        val challenge = data.getQueryParameter("challengeId").orEmpty()
        val credential = data.getQueryParameter("credential").orEmpty()

        if (challenge.isBlank() ||
            challenge != googleChallengeId ||
            credential.length !in 100..8000
        ) {
            nativeGoogleError("Le retour Google n’est pas valide. Réessayez.")
            return
        }

        deliverGoogleCredential(credential, challenge)
    }

    private fun nativeGoogleError(message: String) {
        if (!::webView.isInitialized) return
        runOnUiThread {
            val quoted = JSONObject.quote(message)
            webView.evaluateJavascript(
                "window.cdqNativeGoogleErrorV2506 && " +
                    "window.cdqNativeGoogleErrorV2506($quoted);",
                null
            )
        }
    }

    private fun deliverGoogleCredential(token: String, challenge: String) {
        if (!::webView.isInitialized) return

        val tokenQuoted = JSONObject.quote(token)
        val challengeQuoted = JSONObject.quote(challenge)

        webView.evaluateJavascript(
            "window.cdqNativeGoogleCredentialV2506 && " +
                "window.cdqNativeGoogleCredentialV2506($tokenQuoted,$challengeQuoted);",
            null
        )

        googleChallengeId = ""
        googleNonce = ""
        googleClientId = ""
    }

    private fun checkForNativeUpdateOnLaunch() {
        if (startupUpdateStarted) return
        startupUpdateStarted = true

        startupUpdateExecutor.execute {
            try {
                val conn = URL(UPDATE_MANIFEST_URL).openConnection() as HttpURLConnection
                conn.connectTimeout = 6000
                conn.readTimeout = 6000
                conn.instanceFollowRedirects = true
                conn.setRequestProperty("Cache-Control", "no-cache, no-store")
                conn.setRequestProperty("Pragma", "no-cache")

                val body = try {
                    if (conn.responseCode !in 200..299) return@execute
                    conn.inputStream.bufferedReader().use { it.readText() }
                } finally {
                    conn.disconnect()
                }

                val json = JSONObject(body)
                val latestCode = json.optLong("versionCode", 0L)
                val updatePolicy = NativeUpdatePolicy(
                    getSharedPreferences(NativeUpdatePolicy.PREFERENCES, MODE_PRIVATE)
                )
                if (!updatePolicy.mayPromptAutomatically(currentVersionCodeForUpdate(), latestCode)) return@execute

                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    try {
                        startActivity(
                            Intent(this, UpdateActivity::class.java)
                                .putExtra("auto", true)
                        )
                    } catch (_: Exception) {
                        // L'application continue normalement si l'updater Android
                        // n'est pas disponible pour une raison exceptionnelle.
                    }
                }
            } catch (_: Exception) {
                // Hors ligne ou canal indisponible : ne jamais bloquer Balance CDQ.
            }
        }
    }

    private fun currentVersionCodeForUpdate(): Long {
        val info = packageManager.getPackageInfo(packageName, 0)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            info.versionCode.toLong()
        }
    }

    private fun handleNavigation(url: String): Boolean {
        return try {
            // A Sheet must never replace the CDQ WebView, including old web fallbacks.
            val uri = Uri.parse(url)
            val sheetId = if (uri.scheme == "https" && uri.host == "docs.google.com")
                Regex("^/spreadsheets/d/([A-Za-z0-9_-]{10,200})(?:/|$)").find(uri.path.orEmpty())?.groupValues?.get(1)
            else null
            if (sheetId != null) {
                NativeBridge().openSheet(sheetId, uri.getQueryParameter("authuser"), uri.path.orEmpty().endsWith("/preview"))
                return true
            }
            if (startupRemoteLocked && (
                    url.startsWith("cdqpdf://", true) ||
                    url.startsWith("cdqsheet://", true) ||
                    url.startsWith("cdqnote://", true) ||
                    url.startsWith("intent://open?", true)
                )
            ) {
                Toast.makeText(
                    this,
                    "Validation sécurisée en arrière-plan. Les fichiers distants seront disponibles dans un instant.",
                    Toast.LENGTH_SHORT
                ).show()
                return true
            }
            when {
                url.startsWith("intent://", ignoreCase = true) -> {
                    val parsed = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                    val fallback = parsed.getStringExtra("browser_fallback_url")
                    parsed.removeExtra("browser_fallback_url")

                    try {
                        startActivity(parsed)
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
                    url.startsWith("cdqnote://", true) ||
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

    @Suppress("DEPRECATION")
    private fun isInstalled(packageName: String): Boolean =
        try {
            packageManager.getPackageInfo(packageName, 0)
            true
        } catch (_: Exception) {
            false
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
        outState.putString("cdqEmbeddedVersion", "25.39")
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
        startupUpdateExecutor.shutdownNow()
        biometricRequestId = ""
        biometricCancellation?.cancel()
        biometricCancellation = null
        clearStartupGrant()
        startupRemoteLocked = false
        earlyBiometricRequestId = ""
        earlyBiometricSuccess = null
        earlyBiometricMessage = ""
        earlyBiometricGrant = ""
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.removeAllViews()
            webView.destroy()
        }
        super.onDestroy()
    }
}
