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

internal object LocalSessionTicketCodec {
    const val MAX_TTL_MS = 8L * 60L * 60L * 1000L
    private const val MIN_TTL_MS = 60_000L

    private fun normalizeEmail(value: String): String =
        value.trim().lowercase().take(320)

    private fun normalizeRole(value: String): String = when (value.trim().lowercase()) {
        "admin" -> "admin"
        "lecture" -> "lecture"
        else -> "technicien"
    }

    private fun tokenHash(token: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(token.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    fun create(
        email: String,
        role: String,
        deviceToken: String,
        nowMs: Long,
        requestedTtlMs: Long
    ): String? {
        val normalizedEmail = normalizeEmail(email)
        val token = deviceToken.trim()
        if (!normalizedEmail.contains("@") || token.length !in 8..500) return null
        val ttl = requestedTtlMs.coerceIn(MIN_TTL_MS, MAX_TTL_MS)
        return JSONObject()
            .put("schema", 1)
            .put("email", normalizedEmail)
            .put("role", normalizeRole(role))
            .put("deviceTokenSha256", tokenHash(token))
            .put("issuedAt", nowMs)
            .put("expiresAt", nowMs + ttl)
            .toString()
    }

    fun validate(
        payload: String,
        email: String,
        deviceToken: String,
        nowMs: Long
    ): String? {
        return try {
            val obj = JSONObject(payload)
            val normalizedEmail = normalizeEmail(email)
            val token = deviceToken.trim()
            if (obj.optInt("schema") != 1 ||
                obj.optString("email") != normalizedEmail ||
                token.length !in 8..500 ||
                obj.optString("deviceTokenSha256") != tokenHash(token)
            ) return null
            val issuedAt = obj.optLong("issuedAt", 0L)
            val expiresAt = obj.optLong("expiresAt", 0L)
            if (issuedAt <= 0L || expiresAt <= nowMs || expiresAt - issuedAt > MAX_TTL_MS) return null
            JSONObject()
                .put("schema", 1)
                .put("email", normalizedEmail)
                .put("role", normalizeRole(obj.optString("role")))
                .put("issuedAt", issuedAt)
                .put("expiresAt", expiresAt)
                .toString()
        } catch (_: Exception) {
            null
        }
    }
}

internal class LocalSessionStore(context: Context) {
    companion object {
        private const val PREFS = "cdq_local_session_v2537"
        private const val KEY_ALIAS = "balance-cdq-local-session-v2537"
        private const val CIPHER_TEXT = "cipher"
        private const val IV = "iv"
    }

    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    fun save(email: String, role: String, deviceToken: String, ttlMs: Long): Boolean {
        return try {
            val payload = LocalSessionTicketCodec.create(
                email, role, deviceToken, System.currentTimeMillis(), ttlMs
            ) ?: return false
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key())
            val encrypted = cipher.doFinal(payload.toByteArray(Charsets.UTF_8))
            prefs.edit()
                .putString(CIPHER_TEXT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
                .apply()
            true
        } catch (_: Exception) {
            clear()
            false
        }
    }

    fun readAfterBiometric(email: String, deviceToken: String): String {
        return try {
            val encrypted = Base64.decode(prefs.getString(CIPHER_TEXT, null) ?: return "", Base64.NO_WRAP)
            val iv = Base64.decode(prefs.getString(IV, null) ?: return "", Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
            val payload = String(cipher.doFinal(encrypted), Charsets.UTF_8)
            LocalSessionTicketCodec.validate(
                payload, email, deviceToken, System.currentTimeMillis()
            ) ?: run {
                clear()
                return ""
            }
        } catch (_: Exception) {
            clear()
            ""
        }
    }

    fun clear() {
        prefs.edit().clear().apply()
    }
}
