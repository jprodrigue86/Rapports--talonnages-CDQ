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
        assertTrue(response.data.bufferedReader().readText().contains("25.37-fast-local-unlock"))
        val selector = loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${PackagedWebAssets.PREFIX}Selector.html"))!!
        val html = selector.data.bufferedReader().readText()
        assertTrue(html.contains("./embedded-rpc.js"))
        assertTrue(html.contains("./safe-viewport-v2532.js"))
        assertTrue(html.contains("id=\"cdqPersonalSizingV2533\""))
        assertTrue(html.contains("id=\"cdqWholeWordsV2534\""))
        assertTrue(html.contains("id=\"cdqFullNamesV2536\""))
        assertTrue(html.contains("cdqLocalProvisionalV2537"))
        assertTrue(html.contains("cdqServerConfirmed"))
        assertTrue(html.contains("id=\"cdq-instant-files-2530\""))
        assertTrue(html.contains("id=\"cdqHomeUnderlineV2531\""))
        assertTrue(html.contains("html:is(.android,.ios,.mobile-device) .bottom-nav > .bottom-nav-item.cdq-nav-home.active::after{content:none!important;display:none!important}"))
        val safe = loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${PackagedWebAssets.PREFIX}safe-viewport-v2532.js"))!!
        assertEquals(200, safe.statusCode)
        assertTrue(safe.data.bufferedReader().readText().contains("cdqSafeFrame"))
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
