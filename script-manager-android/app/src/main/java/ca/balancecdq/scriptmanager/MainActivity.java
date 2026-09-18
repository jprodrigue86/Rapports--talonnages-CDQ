package ca.balancecdq.scriptmanager;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;

public class MainActivity extends Activity {
    private static final Uri APP_URL = Uri.parse(
        "https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/?v=13&source=android-apk"
    );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildLoadingScreen();
        openScriptManager();
    }

    private void buildLoadingScreen() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(48, 48, 48, 48);
        root.setBackgroundColor(Color.rgb(7, 17, 31));

        TextView logo = new TextView(this);
        logo.setText("CDQ");
        logo.setTextColor(Color.WHITE);
        logo.setTextSize(34f);
        logo.setGravity(Gravity.CENTER);
        logo.setTypeface(null, android.graphics.Typeface.BOLD);
        root.addView(logo, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        TextView title = new TextView(this);
        title.setText("Apps Script Manager");
        title.setTextColor(Color.rgb(244, 248, 255));
        title.setTextSize(20f);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 18, 0, 28);
        root.addView(title);

        ProgressBar progress = new ProgressBar(this);
        root.addView(progress);

        TextView info = new TextView(this);
        info.setText("Ouverture sécurisée avec Chrome…");
        info.setTextColor(Color.rgb(156, 176, 204));
        info.setTextSize(13f);
        info.setGravity(Gravity.CENTER);
        info.setPadding(0, 24, 0, 0);
        root.addView(info);

        setContentView(root);
    }

    private void openScriptManager() {
        CustomTabColorSchemeParams params = new CustomTabColorSchemeParams.Builder()
            .setToolbarColor(Color.rgb(7, 17, 31))
            .setNavigationBarColor(Color.rgb(5, 10, 18))
            .build();

        CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder()
            .setDefaultColorSchemeParams(params)
            .setShowTitle(false)
            .setUrlBarHidingEnabled(true)
            .build();

        if (isPackageInstalled("com.android.chrome")) {
            customTabsIntent.intent.setPackage("com.android.chrome");
        }

        customTabsIntent.launchUrl(this, APP_URL);
    }

    @SuppressWarnings("deprecation")
    private boolean isPackageInstalled(String packageName) {
        try {
            getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
