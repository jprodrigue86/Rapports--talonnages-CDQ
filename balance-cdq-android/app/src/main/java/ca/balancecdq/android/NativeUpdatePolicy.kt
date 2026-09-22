package ca.balancecdq.android

import android.content.SharedPreferences

/** A cancelled or interrupted automatic update must not take over every launch. */
internal class NativeUpdatePolicy(private val preferences: SharedPreferences) {
    fun mayPromptAutomatically(installed: Long, target: Long): Boolean =
        target > installed && !preferences.getBoolean(attemptKey(installed, target), false)

    fun claimAutomaticPrompt(installed: Long, target: Long): Boolean = synchronized(lock) {
        if (!mayPromptAutomatically(installed, target)) return@synchronized false
        // Commit before leaving the process for Android's installer. apply() alone
        // may lose the guard if installation replaces/kills this process.
        preferences.edit().putBoolean(attemptKey(installed, target), true).commit()
    }

    private fun attemptKey(installed: Long, target: Long) = "automatic.$installed.$target"

    companion object {
        const val PREFERENCES = "cdq_native_updates"
        private val lock = Any()

        fun shouldPrepare(installed: Long, target: Long, automatic: Boolean, force: Boolean): Boolean =
            target > installed || (target == installed && force && !automatic)
    }
}
