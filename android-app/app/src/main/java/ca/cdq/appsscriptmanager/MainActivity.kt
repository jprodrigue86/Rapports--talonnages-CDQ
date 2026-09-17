package ca.cdq.appsscriptmanager

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import androidx.browser.customtabs.CustomTabsIntent

class MainActivity : Activity() {
    private val appUrl = Uri.parse("https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/?from=android-apk")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        openManager()
    }

    private fun openManager() {
        val customTabs = CustomTabsIntent.Builder()
            .setShowTitle(false)
            .setUrlBarHidingEnabled(true)
            .setToolbarColor(Color.rgb(7, 17, 31))
            .setNavigationBarColor(Color.rgb(5, 10, 18))
            .build()

        customTabs.intent.setPackage("com.android.chrome")

        try {
            customTabs.launchUrl(this, appUrl)
        } catch (_: ActivityNotFoundException) {
            startActivity(Intent(Intent.ACTION_VIEW, appUrl))
        } finally {
            finish()
        }
    }
}
