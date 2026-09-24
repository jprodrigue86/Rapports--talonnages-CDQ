package ca.balancecdq.android

import android.net.Uri
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class PackagedWebAssetsTest {
    private fun loader() = PackagedWebAssets(RuntimeEnvironment.getApplication())

    @Test fun `startup and images are supplied from installed assets`() {
        val loader = loader()
        val response = loader.intercept(Uri.parse(PackagedWebAssets.START_URL))!!
        assertEquals(200, response.statusCode)
        assertTrue(response.data.bufferedReader().readText().contains("25.28-apk-embarquee"))
        val selector = loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${PackagedWebAssets.PREFIX}Selector.html"))!!
        assertTrue(selector.data.bufferedReader().readText().contains("./embedded-rpc.js"))
        val image = loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${PackagedWebAssets.PREFIX}assets/music-wall-android-v2523.webp"))!!
        assertEquals("image/webp", image.mimeType)
        assertTrue(image.data.readBytes().size > 100000)
    }

    @Test fun `live data and updates never use a packaged response`() {
        val loader = loader()
        for (url in listOf("https://script.google.com/macros/s/test/exec", "https://drive.google.com/file/d/test", "https://${PackagedWebAssets.HOST}${PackagedWebAssets.ROOT}version.json", "https://${PackagedWebAssets.HOST}${PackagedWebAssets.ROOT}bundles/balance-cdq/latest/manifest.json"))
            assertNull(url, loader.intercept(Uri.parse(url)))
        assertNull(loader.intercept(Uri.parse(PackagedWebAssets.START_URL), "POST"))
    }

    @Test fun `unknown embedded resources cannot silently fall back to internet`() {
        val loader = loader()
        assertEquals(404, loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${PackagedWebAssets.PREFIX}missing.js"))!!.statusCode)
        assertEquals(404, loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${PackagedWebAssets.PREFIX}%2e%2e/private"))!!.statusCode)
        assertNull(loader.intercept(Uri.parse("https://example.invalid${PackagedWebAssets.PREFIX}index.html")))
        assertNull(loader.intercept(Uri.parse(PackagedWebAssets.START_URL.replace("https:", "http:"))))
    }
}
