package ca.balancecdq.android

import android.content.Intent
import android.content.pm.PackageInfo
import android.os.Bundle
import android.widget.Button
import java.io.File
import java.lang.reflect.InvocationTargetException
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** Isolates Android lifecycle/installer navigation from the live update channel. */
class OfflineUpdateActivity : UpdateActivity() {
    var checks = 0
    override fun checkUpdate() { checks++ }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class UpdateActivityTest {
    private fun set(activity: UpdateActivity, name: String, value: Any) {
        UpdateActivity::class.java.getDeclaredField(name).apply { isAccessible = true }.set(activity, value)
    }

    private fun apk(activity: UpdateActivity): File =
        File(activity.cacheDir, "updates/test-update.apk").apply {
            parentFile!!.mkdirs()
            writeText("Lifecycle test; never installed")
        }

    @Test fun `restoring an already launched installer closes updater without downloading again`() {
        val state = Bundle().apply { putBoolean("installationIntentLaunched", true) }
        val controller = Robolectric.buildActivity(OfflineUpdateActivity::class.java).create(state)
        assertTrue(controller.get().isFinishing)
        assertEquals(0, controller.get().checks)
        assertNull(shadowOf(controller.get()).nextStartedActivity)
        controller.destroy()
    }

    @Test fun `returning to a prepared updater does not automatically open installer`() {
        val controller = Robolectric.buildActivity(OfflineUpdateActivity::class.java).create().start()
        val activity = controller.get()
        set(activity, "autoInstall", true)
        set(activity, "downloadedApk", apk(activity))
        val action = UpdateActivity::class.java.getDeclaredField("action").apply { isAccessible = true }
            .get(activity) as Button
        action.isEnabled = true
        shadowOf(activity.packageManager).setCanRequestPackageInstalls(true)
        controller.resume()
        assertNull(shadowOf(activity).nextStartedActivity)
        controller.pause().stop().destroy()
    }

    @Test fun `launching Android installer removes updater from back stack and remembers handoff`() {
        val controller = Robolectric.buildActivity(OfflineUpdateActivity::class.java).create().start().resume()
        val activity = controller.get()
        UpdateActivity::class.java.getDeclaredMethod("installApk", File::class.java).apply {
            isAccessible = true
        }.invoke(activity, apk(activity))
        val install = shadowOf(activity).nextStartedActivity
        assertNotNull(install)
        assertEquals(Intent.ACTION_VIEW, install.action)
        assertEquals("application/vnd.android.package-archive", install.type)
        assertTrue(install.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0)
        assertTrue(activity.isFinishing)
        val state = Bundle()
        controller.saveInstanceState(state)
        assertTrue(state.getBoolean("installationIntentLaunched"))
        controller.pause().stop().destroy()
    }

    @Test fun `version installed while preparing is not installed again`() {
        val controller = Robolectric.buildActivity(OfflineUpdateActivity::class.java).create()
        val activity = controller.get()
        val installed = activity.packageManager.getPackageInfo(activity.packageName, 0).longVersionCode
        set(activity, "autoInstall", true)
        set(activity, "forceInstall", true)
        set(activity, "downloadedApk", apk(activity))
        set(activity, "latestVersionCode", installed)
        UpdateActivity::class.java.getDeclaredMethod("beginInstallFlow").apply {
            isAccessible = true
        }.invoke(activity)
        assertTrue(activity.isFinishing)
        assertNull(shadowOf(activity).nextStartedActivity)
        controller.destroy()
    }

    @Test fun `APK with older embedded version is refused even if channel labels it newer`() {
        val controller = Robolectric.buildActivity(OfflineUpdateActivity::class.java).create()
        val activity = controller.get()
        val file = apk(activity)
        val info = PackageInfo().apply {
            packageName = activity.packageName
            setLongVersionCode(2512)
        }
        shadowOf(activity.packageManager).setPackageArchiveInfo(file.absolutePath, info)
        val error = assertThrows(InvocationTargetException::class.java) {
            UpdateActivity::class.java.getDeclaredMethod("validateApkVersion", File::class.java, Long::class.javaPrimitiveType).apply {
                isAccessible = true
            }.invoke(activity, file, 2513L)
        }
        assertTrue(error.cause is IllegalStateException)
        assertFalse(file.exists())
        assertNull(shadowOf(activity).nextStartedActivity)
        controller.destroy()
    }
}
