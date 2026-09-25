package ca.balancecdq.android

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class FastLocalSessionStore(private val context: Context) {
    data class Ticket(val email: String, val expiresAt: Long)

    companion object {
        private const val KEY_ALIAS = "balance_cdq_fast_session_v1"
        private const val PREFS = "balance_cdq_fast_session"
        private const val VALUE = "ticket"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val IV_BYTES = 12
        const val TTL_MS = 30L * 60L * 1000L
    }

    private val prefs by lazy {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = store.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing

        val generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        )
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    private fun normalizeEmail(value: String): String =
        value.trim().lowercase().take(254)

    private fun tokenDigest(value: String): ByteArray =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))

    fun save(email: String, deviceToken: String, now: Long = System.currentTimeMillis()): Boolean {
        val normalized = normalizeEmail(email)
        val token = deviceToken.trim()
        if (normalized.isBlank() || token.length !in 8..512) return false

        return try {
            val payload = JSONObject()
                .put("schema", 1)
                .put("email", normalized)
                .put("tokenHash", Base64.encodeToString(tokenDigest(token), Base64.NO_WRAP))
                .put("issuedAt", now)
                .put("expiresAt", now + TTL_MS)
                .toString()
                .toByteArray(Charsets.UTF_8)

            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, key())
            val encrypted = cipher.doFinal(payload)
            val packed = ByteArray(cipher.iv.size + encrypted.size)
            System.arraycopy(cipher.iv, 0, packed, 0, cipher.iv.size)
            System.arraycopy(encrypted, 0, packed, cipher.iv.size, encrypted.size)
            prefs.edit().putString(VALUE, Base64.encodeToString(packed, Base64.NO_WRAP)).apply()
            true
        } catch (_: Exception) {
            clear()
            false
        }
    }

    fun read(email: String, deviceToken: String, now: Long = System.currentTimeMillis()): Ticket? {
        val normalized = normalizeEmail(email)
        val token = deviceToken.trim()
        if (normalized.isBlank() || token.length !in 8..512) return null

        return try {
            val encoded = prefs.getString(VALUE, null) ?: return null
            val packed = Base64.decode(encoded, Base64.DEFAULT)
            if (packed.size <= IV_BYTES + 16) return null
            val iv = packed.copyOfRange(0, IV_BYTES)
            val encrypted = packed.copyOfRange(IV_BYTES, packed.size)

            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
            val payload = JSONObject(String(cipher.doFinal(encrypted), Charsets.UTF_8))

            if (payload.optInt("schema") != 1) return clearAndNull()
            if (payload.optString("email") != normalized) return null
            val expiresAt = payload.optLong("expiresAt", 0L)
            val issuedAt = payload.optLong("issuedAt", 0L)
            if (issuedAt <= 0L || expiresAt <= now || expiresAt - issuedAt > TTL_MS + 5_000L)
                return clearAndNull()

            val storedHash = Base64.decode(payload.optString("tokenHash"), Base64.DEFAULT)
            val actualHash = tokenDigest(token)
            if (!MessageDigest.isEqual(storedHash, actualHash)) return null
            Ticket(normalized, expiresAt)
        } catch (_: Exception) {
            clearAndNull()
        }
    }

    fun clear() {
        prefs.edit().remove(VALUE).apply()
    }

    private fun clearAndNull(): Ticket? {
        clear()
        return null
    }
}
