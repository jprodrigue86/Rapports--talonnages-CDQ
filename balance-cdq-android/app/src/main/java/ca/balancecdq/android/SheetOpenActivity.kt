package ca.balancecdq.android

import android.accounts.AccountManager
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast

class SheetOpenActivity : Activity() {
    companion object {
        private const val REQ_ACCOUNT = 23111
        private const val REQ_SHEET = 25260
        private const val SHEETS_PACKAGE = "com.google.android.apps.docs.editors.sheets"
    }

    private var fileId = ""
    private var preferredEmail = ""
    private var accountMode = "auto"
    private var sessionEmail = ""
    private var readOnly = false
    private var launched = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        parse(intent)
        launched = savedInstanceState?.getBoolean("sheetLaunched") == true
        // Android can recreate this parent while the editor is still on top.
        // Do not reopen the editor or ask for the account again.
        if (!launched) openOrChoose()
    }

    override fun onNewIntent(newIntent: Intent?) {
        super.onNewIntent(newIntent)
        if (newIntent == null) return
        intent = newIntent
        launched = false
        parse(newIntent)
        openOrChoose()
    }

    private fun parse(source: Intent) {
        val data = source.data
        fileId = data?.getQueryParameter("fileId").orEmpty()
        preferredEmail = data?.getQueryParameter("account").orEmpty().trim().lowercase()
        accountMode = data?.getQueryParameter("accountMode").orEmpty().trim().lowercase().ifBlank { "auto" }
        sessionEmail = ""
        readOnly = data?.getQueryParameter("readOnly") == "1"
    }

    private fun valid(): Boolean =
        fileId.matches(Regex("^[A-Za-z0-9_-]{10,200}$"))

    private fun openOrChoose() {
        if (!valid()) {
            fail("Google Sheet invalide.")
            return
        }

        if (accountMode == "ask") {
            chooseAccount()
            return
        }

        if (preferredEmail.isNotBlank()) {
            sessionEmail = preferredEmail
            if (accountMode == "default") {
                DefaultGoogleAccountStore.save(this, preferredEmail)
            }
            openNativeSheet()
            return
        }

        val saved = DefaultGoogleAccountStore.email(this)
        if (saved.isBlank()) {
            chooseAccount()
            return
        }

        sessionEmail = saved
        openNativeSheet()
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
            fail(e.message ?: "Sélecteur de compte Google indisponible.")
        }
    }

    @Deprecated("Résultat du sélecteur Google.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_SHEET) {
            returnToCdq()
            return
        }
        if (requestCode != REQ_ACCOUNT) return

        if (resultCode != RESULT_OK) {
            returnToCdq()
            return
        }

        val email = DefaultGoogleAccountStore.readResult(data)
        if (email.isBlank()) {
            returnToCdq()
            return
        }

        sessionEmail = email
        if (accountMode != "ask") {
            DefaultGoogleAccountStore.save(this, email)
        }
        openNativeSheet()
    }

    private fun openNativeSheet() {
        val email = sessionEmail.ifBlank { DefaultGoogleAccountStore.email(this) }
        if (email.isBlank()) {
            chooseAccount()
            return
        }

        // Android account ordering is not Google's web-session ordering.
        // Pass the selected address; never silently substitute account zero.
        val uri = Uri.parse(
            "https://docs.google.com/spreadsheets/d/" + Uri.encode(fileId) +
                (if (readOnly) "/preview" else "/edit") + "?usp=drivesdk&authuser=" + Uri.encode(email)
        )

        val native = Intent(Intent.ACTION_VIEW, uri).apply {
            setPackage(SHEETS_PACKAGE)

            // Plusieurs clés sont envoyées pour compatibilité avec les
            // différentes versions de l'application Google Sheets.
            putExtra("authAccount", email)
            putExtra(AccountManager.KEY_ACCOUNT_NAME, email)
            putExtra("accountName", email)
            putExtra(Intent.EXTRA_EMAIL, arrayOf(email))

            // Keep the editor above its CDQ parent; no separate task or clear-top.
        }

        try {
            if (native.resolveActivity(packageManager) != null) {
                launched = true
                startActivityForResult(native, REQ_SHEET)
                return
            }
        } catch (_: Exception) {
        }

        // Repli : navigateur uniquement si Google Sheets n'est pas installé.
        val tab = androidx.browser.customtabs.CustomTabsIntent.Builder()
            .setShowTitle(false).build()
        val fallback = tab.intent.apply { data = uri }

        try {
            launched = true
            startActivityForResult(fallback, REQ_SHEET)
        } catch (_: ActivityNotFoundException) {
            fail("Google Sheets n’est pas installé et aucun navigateur n’est disponible.")
        }
    }

    private fun fail(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        returnToCdq()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putBoolean("sheetLaunched", launched)
        super.onSaveInstanceState(outState)
    }

    private fun returnToCdq() {
        // A deep link can create us without a CDQ parent. Reuse the main task.
        if (isTaskRoot) startActivity(Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        })
        finish()
    }
}
