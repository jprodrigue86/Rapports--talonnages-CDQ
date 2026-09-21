package ca.balancecdq.android

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast

class AccountSettingsActivity : Activity() {
    companion object {
        private const val REQ_ACCOUNT = 23110
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startPicker()
    }

    override fun onNewIntent(newIntent: Intent?) {
        super.onNewIntent(newIntent)
        intent = newIntent
        startPicker()
    }

    private fun startPicker() {
        try {
            startActivityForResult(
                DefaultGoogleAccountStore.pickerIntent(this),
                REQ_ACCOUNT
            )
        } catch (e: Exception) {
            Toast.makeText(
                this,
                e.message ?: "Sélecteur de compte Google indisponible.",
                Toast.LENGTH_LONG
            ).show()
            finish()
        }
    }

    @Deprecated("Résultat du sélecteur Google.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_ACCOUNT) return

        if (resultCode == RESULT_OK) {
            val email = DefaultGoogleAccountStore.readResult(data)
            if (email.isNotBlank()) {
                DefaultGoogleAccountStore.save(this, email)
                Toast.makeText(
                    this,
                    "Compte Google par défaut : $email",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
        finish()
    }
}
