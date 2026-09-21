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
        private const val SHEETS_PACKAGE = "com.google.android.apps.docs.editors.sheets"
    }

    private var fileId = ""
    private var preferredEmail = ""
    private var accountMode = "auto"
    private var sessionEmail = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        parse(intent)
        openOrChoose()
    }

    override fun onNewIntent(newIntent: Intent?) {
        super.onNewIntent(newIntent)
        if (newIntent == null) return
        intent = newIntent
        parse(newIntent)
        openOrChoose()
    }

    private fun parse(source: Intent) {
        val data = source.data
        fileId = data?.getQueryParameter("fileId").orEmpty()
        preferredEmail = data?.getQueryParameter("account").orEmpty().trim().lowercase()
        accountMode = data?.getQueryParameter("accountMode").orEmpty().trim().lowercase().ifBlank { "auto" }
        sessionEmail = ""
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
                DefaultGoogleAccountStore.pickerIntent(this, preferredEmail),
                REQ_ACCOUNT
            )
        } catch (e: Exception) {
            fail(e.message ?: "Sélecteur de compte Google indisponible.")
        }
    }

    @Deprecated("Résultat du sélecteur Google.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_ACCOUNT) return

        if (resultCode != RESULT_OK) {
            finish()
            return
        }

        val email = DefaultGoogleAccountStore.readResult(data)
        if (email.isBlank()) {
            finish()
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

        val accountIndex = DefaultGoogleAccountStore.accountIndex(this, email)

        // Google Sheets ne documente pas d'extra Android permettant à une
        // application tierce d'imposer son compte actif. Le chemin /u/N/
        // est donc inclus directement dans l'URL Google multi-compte.
        val uri = Uri.parse(
            "https://docs.google.com/spreadsheets/u/" +
                accountIndex +
                "/d/" + Uri.encode(fileId) +
                "/edit?usp=drivesdk&authuser=" + accountIndex +
                "&login_hint=" + Uri.encode(email)
        )

        val native = Intent(Intent.ACTION_VIEW, uri).apply {
            setPackage(SHEETS_PACKAGE)

            // Plusieurs clés sont envoyées pour compatibilité avec les
            // différentes versions de l'application Google Sheets.
            putExtra("authAccount", email)
            putExtra(AccountManager.KEY_ACCOUNT_NAME, email)
            putExtra("accountName", email)
            putExtra("account_index", accountIndex)
            putExtra(Intent.EXTRA_EMAIL, arrayOf(email))

            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

        try {
            if (native.resolveActivity(packageManager) != null) {
                startActivity(native)
                finish()
                return
            }
        } catch (_: Exception) {
        }

        // Repli : navigateur uniquement si Google Sheets n'est pas installé.
        val fallback = Intent(Intent.ACTION_VIEW, uri).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        try {
            startActivity(fallback)
            finish()
        } catch (_: ActivityNotFoundException) {
            fail("Google Sheets n’est pas installé et aucun navigateur n’est disponible.")
        }
    }

    private fun fail(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        finish()
    }
}
