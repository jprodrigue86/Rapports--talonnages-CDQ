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
        assertEquals("/Rapports--talonnages-CDQ/native/v25.43/", loader.prefix)
        assertEquals(
            "https://jprodrigue86.github.io/Rapports--talonnages-CDQ/native/v25.43/index.html",
            loader.startUrl
        )
        val response = loader.intercept(Uri.parse(loader.startUrl))!!
        assertEquals(200, response.statusCode)
        val shell = response.data.bufferedReader().readText()
        assertTrue(shell.contains("25.43-stable-first-frame"))
        assertTrue(shell.contains("CDQ_FIRST_FRAME_STABLE_V2543"))
        assertTrue(shell.contains("1500"))
        val selector = loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${loader.prefix}Selector.html"))!!
        val html = selector.data.bufferedReader().readText()
        assertTrue(html.contains("./embedded-rpc.js"))
        assertTrue(html.contains("./first-frame-stable-v2543.js"))
        assertTrue(html.contains("./icon-artwork-baseline-v2540.css"))
        assertTrue(html.contains("./safe-viewport-v2532.js"))
        assertTrue(html.contains("id=\"cdqPersonalSizingV2533\""))
        assertTrue(html.contains("id=\"cdqWholeWordsV2534\""))
        assertTrue(html.contains("id=\"cdqFullNamesV2536\""))
        assertTrue(html.contains("id=\"cdq-instant-files-2530\""))
        assertTrue(html.contains("id=\"cdqHomeUnderlineV2531\""))
        assertTrue(html.contains("html:is(.android,.ios,.mobile-device) .bottom-nav > .bottom-nav-item.cdq-nav-home.active::after{content:none!important;display:none!important}"))
        val warm = loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${loader.prefix}warm-unlock-v2540.js"))!!
        assertEquals(200, warm.statusCode)
        assertTrue(warm.data.bufferedReader().readText().contains("cdqWarmUnlockV2540"))
        val settle = loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${loader.prefix}first-frame-stable-v2543.js"))!!
        assertEquals(200, settle.statusCode)
        assertTrue(settle.data.bufferedReader().readText().contains("CDQ_FIRST_FRAME_ARM_V2543"))
        assertTrue(settle.data.bufferedReader().readText().contains("CDQ_FIRST_FRAME_STABLE_V2543"))
        val artwork = loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${loader.prefix}icon-artwork-baseline-v2540.css"))!!
        assertEquals(200, artwork.statusCode)
        assertTrue(artwork.data.bufferedReader().readText().contains("icons-transparent.webp"))
        val safe = loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${loader.prefix}safe-viewport-v2532.js"))!!
        assertEquals(200, safe.statusCode)
        assertTrue(safe.data.bufferedReader().readText().contains("cdqSafeFrame"))
        val sprite = loader.intercept(Uri.parse(
            "https://${PackagedWebAssets.HOST}${loader.prefix}bundles/balance-cdq/v25.15/icons-transparent.webp"
        ))!!
        assertEquals(200, sprite.statusCode)
        assertEquals("image/webp", sprite.mimeType)
        assertTrue(sprite.data.readBytes().size > 500000)

        val reference = loader.intercept(Uri.parse(
            "https://${PackagedWebAssets.HOST}${loader.prefix}bundles/balance-cdq/v25.14/icons-reference.png"
        ))!!
        assertEquals(200, reference.statusCode)
        assertEquals("image/jpeg", reference.mimeType)
        assertTrue(reference.data.readBytes().size > 100000)

        val pdfLib = loader.intercept(Uri.parse(
            "https://${PackagedWebAssets.HOST}${loader.prefix}vendor/pdf-lib-1.17.1.min.js"
        ))!!
        assertEquals(200, pdfLib.statusCode)
        assertTrue(pdfLib.data.readBytes().size > 100000)

        val image = loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${loader.prefix}assets/music-wall-android-v2523.webp"))!!
        assertEquals("image/webp", image.mimeType)
        assertTrue(image.data.readBytes().size > 100000)
    }

    @Test fun `live data and updates never use a packaged response`() {
        val loader = loader()
        for (url in listOf("https://script.google.com/macros/s/test/exec", "https://drive.google.com/file/d/test", "https://${PackagedWebAssets.HOST}${PackagedWebAssets.ROOT}version.json", "https://${PackagedWebAssets.HOST}${PackagedWebAssets.ROOT}bundles/balance-cdq/latest/manifest.json"))
            assertNull(url, loader.intercept(Uri.parse(url)))
        assertNull(loader.intercept(Uri.parse(loader.startUrl), "POST"))
    }

    @Test fun `unknown embedded resources cannot silently fall back to internet`() {
        val loader = loader()
        assertEquals(404, loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${loader.prefix}missing.js"))!!.statusCode)
        assertEquals(404, loader.intercept(Uri.parse("https://${PackagedWebAssets.HOST}${loader.prefix}%2e%2e/private"))!!.statusCode)
        assertNull(loader.intercept(Uri.parse("https://example.invalid${loader.prefix}index.html")))
        assertNull(loader.intercept(Uri.parse(loader.startUrl.replace("https:", "http:"))))
    }
}
