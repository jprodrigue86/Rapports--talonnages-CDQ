package ca.balancecdq.android

import android.accounts.Account
import android.accounts.AccountManager
import android.content.Context
import android.content.Intent
import com.google.android.gms.common.AccountPicker

object DefaultGoogleAccountStore {
    private const val PREFS = "cdq_default_google_account_v1"
    private const val KEY_EMAIL = "email"
    const val GOOGLE_ACCOUNT_TYPE = "com.google"

    fun email(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_EMAIL, "")
            .orEmpty()
            .trim()
            .lowercase()

    fun account(context: Context, preferredEmail: String = ""): Account? {
        val wanted = preferredEmail.trim().lowercase().ifBlank { email(context) }
        if (wanted.isBlank()) return null

        return try {
            AccountManager.get(context)
                .getAccountsByType(GOOGLE_ACCOUNT_TYPE)
                .firstOrNull { it.name.trim().equals(wanted, ignoreCase = true) }
        } catch (_: Exception) {
            null
        }
    }

    fun accountIndex(context: Context): Int {
        val selected = email(context)
        if (selected.isBlank()) return 0

        return try {
            val accounts = AccountManager.get(context)
                .getAccountsByType(GOOGLE_ACCOUNT_TYPE)

            val index = accounts.indexOfFirst {
                it.name.trim().equals(selected, ignoreCase = true)
            }

            if (index >= 0) index else 0
        } catch (_: Exception) {
            0
        }
    }

    fun save(context: Context, email: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_EMAIL, email.trim().lowercase())
            .apply()
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_EMAIL)
            .apply()
    }

    fun pickerIntent(context: Context, preferredEmail: String = ""): Intent {
        val selected = account(context, preferredEmail)

        val options = AccountPicker.AccountChooserOptions.Builder()
            .setAllowableAccountsTypes(listOf(GOOGLE_ACCOUNT_TYPE))
            .setAlwaysShowAccountPicker(true)
            .setSelectedAccount(selected)
            .setTitleOverrideText("Compte Google par défaut — Balance CDQ")
            .build()

        return AccountPicker.newChooseAccountIntent(options)
    }

    fun readResult(data: Intent?): String =
        data?.getStringExtra(AccountManager.KEY_ACCOUNT_NAME)
            .orEmpty()
            .trim()
            .lowercase()
}
