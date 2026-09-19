package ca.balancecdq.android

import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent

class MainActivity : Activity() {
    private val appUrl = Uri.parse(
        "https://jprodrigue86.github.io/Rapports--talonnages-CDQ/?source=balance-cdq-android"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val colors = CustomTabColorSchemeParams.Builder()
            .setToolbarColor(Color.rgb(5, 12, 20))
            .setNavigationBarColor(Color.BLACK)
            .build()

        val tabs = CustomTabsIntent.Builder()
            .setDefaultColorSchemeParams(colors)
            .setShowTitle(false)
            .setUrlBarHidingEnabled(true)
            .build()

        try {
            packageManager.getPackageInfo("com.android.chrome", 0)
            tabs.intent.setPackage("com.android.chrome")
        } catch (_: Exception) {
        }

        tabs.launchUrl(this, appUrl)
        finish()
    }
}
