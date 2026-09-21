package ca.balancecdq.android

import android.accounts.AccountManager
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast

class PdfOpenActivity : Activity() {
    companion object {
        private const val REQ_ACCOUNT = 22731
        private const val DRIVE_PACKAGE = "com.google.android.apps.docs"
    }

    private var fileId = ""
    private var fileName = "Rapport.pdf"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        parseIntent(intent)
        if (!isValid()) {
            fail("Demande PDF invalide.")
            return
        }
        openOrChoose()
    }

    override fun onNewIntent(newIntent: Intent?) {
        super.onNewIntent(newIntent)
        if (newIntent == null) return
        intent = newIntent
        parseIntent(newIntent)
        if (!isValid()) {
            fail("Demande PDF invalide.")
            return
        }
        openOrChoose()
    }

    private fun parseIntent(source: Intent) {
        val data = source.data
        fileId = data?.getQueryParameter("fileId").orEmpty()
        fileName = data?.getQueryParameter("name").orEmpty().ifBlank { "Rapport.pdf" }
    }

    private fun isValid(): Boolean =
        fileId.matches(Regex("^[A-Za-z0-9_-]{10,200}$")) &&
            fileName.length <= 180

    private fun openOrChoose() {
        if (DefaultGoogleAccountStore.account(this) == null) {
            chooseDefaultAccount()
            return
        }
        openNativeDrivePdf()
    }

    private fun chooseDefaultAccount() {
        try {
            startActivityForResult(
                DefaultGoogleAccountStore.pickerIntent(this),
                REQ_ACCOUNT
            )
        } catch (e: Exception) {
            fail(e.message ?: "Impossible d’ouvrir le choix du compte Google.")
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

        DefaultGoogleAccountStore.save(this, email)
        openNativeDrivePdf()
    }

    private fun openNativeDrivePdf() {
        val email = DefaultGoogleAccountStore.email(this)
        if (email.isBlank()) {
            chooseDefaultAccount()
            return
        }

        val uri = Uri.parse(
            "https://drive.google.com/file/d/" +
                Uri.encode(fileId) +
                "/view?usp=drivesdk&authuser=" + Uri.encode(email) +
                "&login_hint=" + Uri.encode(email)
        )

        val native = Intent(Intent.ACTION_VIEW, uri).apply {
            setPackage(DRIVE_PACKAGE)

            putExtra("authAccount", email)
            putExtra(AccountManager.KEY_ACCOUNT_NAME, email)
            putExtra("accountName", email)

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

        // Repli Web seulement si Google Drive n'est pas installé.
        val fallback = Intent(Intent.ACTION_VIEW, uri).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        try {
            startActivity(fallback)
            finish()
        } catch (_: ActivityNotFoundException) {
            fail("Google Drive n’est pas installé et aucun navigateur n’est disponible.")
        }
    }

    private fun fail(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        finish()
    }
}
