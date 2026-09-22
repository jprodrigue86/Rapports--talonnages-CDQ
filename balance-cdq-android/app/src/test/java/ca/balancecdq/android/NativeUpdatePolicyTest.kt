package ca.balancecdq.android

import android.content.Context
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class NativeUpdatePolicyTest {
    private val preferences get() = RuntimeEnvironment.getApplication()
        .getSharedPreferences(NativeUpdatePolicy.PREFERENCES, Context.MODE_PRIVATE)

    @Before fun reset() { preferences.edit().clear().commit() }

    @Test fun `installed or older versions never start automatic installation even with force`() {
        for (target in listOf(2511L, 2512L)) {
            assertFalse(NativeUpdatePolicy(preferences).mayPromptAutomatically(2512, target))
            assertFalse(NativeUpdatePolicy.shouldPrepare(2512, target, automatic = true, force = true))
        }
    }

    @Test fun `cancel then restart does not offer the same automatic installation again`() {
        assertTrue(NativeUpdatePolicy(preferences).claimAutomaticPrompt(2511, 2512))
        val afterRestart = NativeUpdatePolicy(preferences)
        assertFalse(afterRestart.mayPromptAutomatically(2511, 2512))
        assertFalse(afterRestart.claimAutomaticPrompt(2511, 2512))
    }

    @Test fun `duplicate updater instances cannot both claim an installation`() {
        val first = NativeUpdatePolicy(preferences)
        val second = NativeUpdatePolicy(preferences)
        assertTrue(first.mayPromptAutomatically(2511, 2512))
        assertTrue(second.mayPromptAutomatically(2511, 2512))
        assertTrue(first.claimAutomaticPrompt(2511, 2512))
        assertFalse(second.claimAutomaticPrompt(2511, 2512))
    }

    @Test fun `a later release is still offered after cancelling an earlier one`() {
        val policy = NativeUpdatePolicy(preferences)
        assertTrue(policy.claimAutomaticPrompt(2511, 2512))
        assertTrue(policy.claimAutomaticPrompt(2511, 2513))
        assertFalse(policy.mayPromptAutomatically(2511, 2512))
    }

    @Test fun `manual retry remains available after cancelling the automatic offer`() {
        NativeUpdatePolicy(preferences).claimAutomaticPrompt(2511, 2512)
        assertTrue(NativeUpdatePolicy.shouldPrepare(2511, 2512, automatic = false, force = false))
    }

    @Test fun `same version reinstall needs an explicit manual action and never downgrades`() {
        assertFalse(NativeUpdatePolicy.shouldPrepare(2512, 2512, automatic = false, force = false))
        assertTrue(NativeUpdatePolicy.shouldPrepare(2512, 2512, automatic = false, force = true))
        assertFalse(NativeUpdatePolicy.shouldPrepare(2512, 2511, automatic = false, force = true))
    }
}
