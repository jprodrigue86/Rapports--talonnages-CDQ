package ca.balancecdq.android

import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)\n@Config(sdk = [28])\nclass LocalSessionStoreTest {
    private val token = "device-token-abcdefghijklmnopqrstuvwxyz"

    @Test fun ticketIsBoundToAccountAndDeviceToken() {
        val now = 1_700_000_000_000L
        val payload = LocalSessionTicketCodec.create(
            " Tech@Example.COM ", "admin", token, now, 60 * 60 * 1000L
        )!!
        val valid = LocalSessionTicketCodec.validate(payload, "tech@example.com", token, now + 1000L)
        assertNotNull(valid)
        assertNull(LocalSessionTicketCodec.validate(payload, "other@example.com", token, now + 1000L))
        assertNull(LocalSessionTicketCodec.validate(payload, "tech@example.com", token + "-other", now + 1000L))
    }

    @Test fun ticketExpiresAndNeverExceedsEightHours() {
        val now = 1_700_000_000_000L
        val payload = LocalSessionTicketCodec.create(
            "tech@example.com", "technicien", token, now, 48L * 60L * 60L * 1000L
        )!!
        assertNotNull(LocalSessionTicketCodec.validate(payload, "tech@example.com", token, now + LocalSessionTicketCodec.MAX_TTL_MS - 1))
        assertNull(LocalSessionTicketCodec.validate(payload, "tech@example.com", token, now + LocalSessionTicketCodec.MAX_TTL_MS + 1))
    }

    @Test fun unknownRolesAreReducedToTechnician() {
        val now = 1_700_000_000_000L
        val payload = LocalSessionTicketCodec.create(
            "tech@example.com", "superuser", token, now, 120_000L
        )!!
        val valid = LocalSessionTicketCodec.validate(payload, "tech@example.com", token, now + 1000L)!!
        assertTrue(valid.contains("\"role\":\"technicien\""))
    }
}
