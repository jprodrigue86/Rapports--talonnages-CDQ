package ca.balancecdq.android

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
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
import android.widget.Toast
import com.google.android.gms.auth.api.identity.BeginSignInRequest
import com.google.android.gms.auth.api.identity.Identity
import org.json.JSONObject

class MainActivity : Activity() {
    companion object {
        private const val REQ_FILE_CHOOSER = 25040
        private const val REQ_NATIVE_GOOGLE = 25041
        private const val APP_URL =
            "https://jprodrigue86.github.io/Rapports--talonnages-CDQ/?source=balance-cdq-android&native=25.04"
    }

    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val oneTapClient by lazy { Identity.getSignInClient(this) }

    private var googleChallengeId = ""
    private var googleNonce = ""
    private var googleClientId = ""

    inner class NativeBridge {
        @JavascriptInterface
        fun loginGoogle(challengeId: String?, nonce: String?, clientId: String?) {
            val challenge = challengeId.orEmpty().trim()
            val n = nonce.orEmpty().trim()
            val client = clientId.orEmpty().trim()

            if (challenge.isBlank() || challenge.length > 200 ||
                n.isBlank() || n.length > 500 ||
                client.isBlank() || client.length > 500
            ) {
                nativeGoogleError("Demande Google invalide.")
                return
            }

            runOnUiThread {
                beginNativeGoogleLogin(challenge, n, client)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
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
                settings.userAgentString + " BalanceCDQAndroid/25.04"

            addJavascriptInterface(NativeBridge(), "BalanceCDQNative")

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

                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    if (url.startsWith("https://jprodrigue86.github.io/Rapports--talonnages-CDQ/")) {
                        installNativeGoogleBridge()
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

    private fun installNativeGoogleBridge() {
        val script = """
            (function(){
              if(window.__cdqNativeGoogleV2504)return;
              window.__cdqNativeGoogleV2504=true;

              function nativeGoogleUiV2504(){
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
                    help.textContent='Connexion Google sécurisée par Balance CDQ Android.';
                  }
                }catch(e){}
              }

              function nativeGoogleStartV2504(){
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

                  nativeGoogleUiV2504();
                  BalanceCDQNative.loginGoogle(
                    String(cdqGoogleChallengeV42.challengeId||''),
                    String(cdqGoogleChallengeV42.nonce||''),
                    String(cdqGoogleChallengeV42.clientId||'')
                  );
                }catch(e){
                  var m=document.getElementById('load-message');
                  if(m)m.textContent='Impossible de démarrer la connexion Google Android.';
                }
              }

              var originalShow=window.afficherConnexionGoogleV42;
              if(typeof originalShow==='function'){
                window.afficherConnexionGoogleV42=async function(){
                  var result=await originalShow.apply(this,arguments);
                  nativeGoogleUiV2504();
                  setTimeout(nativeGoogleUiV2504,80);
                  return result;
                };
              }

              var fallback=document.getElementById('google-touch-fallback');
              if(fallback && !fallback.dataset.cdqNative2504){
                fallback.dataset.cdqNative2504='1';
                fallback.addEventListener('click',function(e){
                  e.preventDefault();
                  e.stopImmediatePropagation();
                  nativeGoogleStartV2504();
                },true);
              }

              window.cdqNativeGoogleCredentialV2504=function(token,challengeId){
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

              window.cdqNativeGoogleErrorV2504=function(message){
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

              nativeGoogleUiV2504();
              setTimeout(nativeGoogleUiV2504,250);
            })();
        """.trimIndent()

        webView.evaluateJavascript(script, null)
    }

    private fun beginNativeGoogleLogin(
        challengeId: String,
        nonce: String,
        clientId: String
    ) {
        googleChallengeId = challengeId
        googleNonce = nonce
        googleClientId = clientId

        val request = BeginSignInRequest.builder()
            .setGoogleIdTokenRequestOptions(
                BeginSignInRequest.GoogleIdTokenRequestOptions.builder()
                    .setSupported(true)
                    .setServerClientId(clientId)
                    .setFilterByAuthorizedAccounts(false)
                    .setNonce(nonce)
                    .build()
            )
            .setAutoSelectEnabled(false)
            .build()

        oneTapClient.beginSignIn(request)
            .addOnSuccessListener { result ->
                try {
                    startIntentSenderForResult(
                        result.pendingIntent.intentSender,
                        REQ_NATIVE_GOOGLE,
                        null,
                        0,
                        0,
                        0
                    )
                } catch (e: Exception) {
                    nativeGoogleError(
                        e.message ?: "Impossible d’ouvrir le sélecteur Google."
                    )
                }
            }
            .addOnFailureListener { error ->
                nativeGoogleError(
                    error.message ?: "Le sélecteur Google Android n’est pas disponible."
                )
            }
    }

    private fun nativeGoogleError(message: String) {
        if (!::webView.isInitialized) return
        runOnUiThread {
            val quoted = JSONObject.quote(message)
            webView.evaluateJavascript(
                "window.cdqNativeGoogleErrorV2504 && " +
                    "window.cdqNativeGoogleErrorV2504($quoted);",
                null
            )
        }
    }

    private fun deliverGoogleCredential(token: String) {
        if (!::webView.isInitialized || googleChallengeId.isBlank()) return

        val tokenQuoted = JSONObject.quote(token)
        val challengeQuoted = JSONObject.quote(googleChallengeId)

        webView.evaluateJavascript(
            "window.cdqNativeGoogleCredentialV2504 && " +
                "window.cdqNativeGoogleCredentialV2504($tokenQuoted,$challengeQuoted);",
            null
        )
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
        when (requestCode) {
            REQ_FILE_CHOOSER -> {
                val result = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                fileCallback?.onReceiveValue(result)
                fileCallback = null
                return
            }

            REQ_NATIVE_GOOGLE -> {
                if (resultCode != RESULT_OK || data == null) {
                    nativeGoogleError("Connexion Google annulée.")
                    return
                }

                try {
                    val credential = oneTapClient.getSignInCredentialFromIntent(data)
                    val token = credential.googleIdToken.orEmpty()
                    if (token.isBlank()) {
                        nativeGoogleError("Google n’a pas retourné de jeton de connexion.")
                        return
                    }
                    deliverGoogleCredential(token)
                } catch (e: Exception) {
                    nativeGoogleError(
                        e.message ?: "Le retour Google Android est invalide."
                    )
                }
                return
            }
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
