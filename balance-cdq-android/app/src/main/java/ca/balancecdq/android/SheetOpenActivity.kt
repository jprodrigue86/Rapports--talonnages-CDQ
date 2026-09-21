package ca.balancecdq.android

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent

class SheetOpenActivity : Activity() {
    companion object {
        private const val REQ_ACCOUNT = 23111
    }

    private var fileId = ""

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
        fileId = source.data?.getQueryParameter("fileId").orEmpty()
    }

    private fun valid(): Boolean =
        fileId.matches(Regex("^[A-Za-z0-9_-]{10,200}$"))

    private fun openOrChoose() {
        if (!valid()) {
            fail("Google Sheet invalide.")
            return
        }

        if (DefaultGoogleAccountStore.account(this) == null) {
            chooseAccount()
            return
        }

        openSheet()
    }

    private fun chooseAccount() {
        try {
            startActivityForResult(
                DefaultGoogleAccountStore.pickerIntent(this),
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

        DefaultGoogleAccountStore.save(this, email)
        openSheet()
    }

    private fun openSheet() {
        val email = DefaultGoogleAccountStore.email(this)
        if (email.isBlank()) {
            chooseAccount()
            return
        }

        val uri = Uri.parse(
            "https://docs.google.com/spreadsheets/d/" +
                Uri.encode(fileId) +
                "/edit?usp=drivesdk&authuser=" + Uri.encode(email) +
                "&login_hint=" + Uri.encode(email)
        )

        val colors = CustomTabColorSchemeParams.Builder()
            .setToolbarColor(Color.rgb(5, 12, 20))
            .setNavigationBarColor(Color.BLACK)
            .build()

        val tabs = CustomTabsIntent.Builder()
            .setDefaultColorSchemeParams(colors)
            .setShowTitle(false)
            .setUrlBarHidingEnabled(true)
            .build()

        try {
            packageManager.getPackageInfo("com.android.chrome", 0)
            tabs.intent.setPackage("com.android.chrome")
        } catch (_: Exception) {
        }

        try {
            tabs.launchUrl(this, uri)
            finish()
        } catch (e: Exception) {
            fail(e.message ?: "Impossible d’ouvrir Google Sheets.")
        }
    }

    private fun fail(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        finish()
    }
}
