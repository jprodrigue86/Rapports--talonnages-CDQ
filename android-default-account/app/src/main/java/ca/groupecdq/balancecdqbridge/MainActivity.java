package ca.groupecdq.balancecdqbridge;

import android.accounts.Account;
import android.accounts.AccountManager;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.google.android.gms.common.AccountPicker;

import java.util.Arrays;

public class MainActivity extends Activity {

    private static final int REQUEST_ACCOUNT = 4107;
    private static final String PREFS = "balance_cdq_native";
    private static final String KEY_ACCOUNT = "default_google_account";
    private static final String PWA_URL =
            "https://jprodrigue86.github.io/Rapports--talonnages-CDQ/";

    private SharedPreferences prefs;
    private TextView accountValue;

    private String pendingKind = "";
    private String pendingId = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        buildUi();
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void buildUi() {
        int pad = dp(22);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad, pad, pad);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(Color.rgb(5, 11, 16));

        TextView title = new TextView(this);
        title.setText("Balance CDQ");
        title.setTextColor(Color.WHITE);
        title.setTextSize(28);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(18), 0, dp(6));
        root.addView(title, fullWidth());

        TextView subtitle = new TextView(this);
        subtitle.setText("Compte Google par défaut");
        subtitle.setTextColor(Color.rgb(121, 218, 255));
        subtitle.setTextSize(18);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 0, 0, dp(28));
        root.addView(subtitle, fullWidth());

        TextView label = new TextView(this);
        label.setText("Compte utilisé pour ouvrir les fichiers :");
        label.setTextColor(Color.rgb(185, 204, 216));
        label.setTextSize(15);
        label.setPadding(0, 0, 0, dp(8));
        root.addView(label, fullWidth());

        accountValue = new TextView(this);
        accountValue.setTextColor(Color.WHITE);
        accountValue.setTextSize(17);
        accountValue.setPadding(dp(14), dp(14), dp(14), dp(14));
        accountValue.setBackgroundColor(Color.rgb(13, 38, 56));
        root.addView(accountValue, fullWidth());
        refreshAccountLabel();

        Button choose = button("Choisir le compte par défaut");
        choose.setOnClickListener(v -> chooseAccount());
        root.addView(choose, buttonParams());

        Button clear = button("Effacer le compte par défaut");
        clear.setOnClickListener(v -> {
            prefs.edit().remove(KEY_ACCOUNT).apply();
            refreshAccountLabel();
            Toast.makeText(this, "Compte par défaut effacé.", Toast.LENGTH_SHORT).show();
        });
        root.addView(clear, buttonParams());

        Button openCdq = button("Ouvrir Balance CDQ");
        openCdq.setOnClickListener(v -> openExternalUrl(PWA_URL, false));
        root.addView(openCdq, buttonParams());

        TextView help = new TextView(this);
        help.setText(
                "Le compte choisi est conservé uniquement sur ce téléphone. " +
                "Quand Balance CDQ ouvre un Google Sheet ou un PDF, cette petite " +
                "application redirige le fichier vers Chrome avec le compte choisi."
        );
        help.setTextColor(Color.rgb(140, 163, 178));
        help.setTextSize(13);
        help.setPadding(0, dp(24), 0, 0);
        root.addView(help, fullWidth());

        setContentView(root);
    }

    private LinearLayout.LayoutParams fullWidth() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
    }

    private LinearLayout.LayoutParams buttonParams() {
        LinearLayout.LayoutParams p = fullWidth();
        p.topMargin = dp(12);
        return p;
    }

    private Button button(String text) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextSize(15);
        b.setTextColor(Color.WHITE);
        b.setAllCaps(false);
        b.setPadding(dp(12), dp(10), dp(12), dp(10));
        return b;
    }

    private void refreshAccountLabel() {
        String email = getDefaultAccount();
        accountValue.setText(email.isEmpty() ? "Aucun compte sélectionné" : email);
    }

    private String getDefaultAccount() {
        return prefs.getString(KEY_ACCOUNT, "").trim();
    }

    private void chooseAccount() {
        String current = getDefaultAccount();
        Account selected = current.isEmpty() ? null : new Account(current, "com.google");

        AccountPicker.AccountChooserOptions options =
                new AccountPicker.AccountChooserOptions.Builder()
                        .setAllowableAccountsTypes(Arrays.asList("com.google"))
                        .setAlwaysShowAccountPicker(true)
                        .setSelectedAccount(selected)
                        .setTitleOverrideText("Compte Google par défaut — Balance CDQ")
                        .build();

        Intent intent = AccountPicker.newChooseAccountIntent(options);
        startActivityForResult(intent, REQUEST_ACCOUNT);
    }

    private void handleIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !"balancecdq".equalsIgnoreCase(data.getScheme())) {
            return;
        }

        String host = data.getHost() == null ? "" : data.getHost();

        if ("pick".equalsIgnoreCase(host)) {
            pendingKind = "";
            pendingId = "";
            chooseAccount();
            return;
        }

        if ("open".equalsIgnoreCase(host)) {
            pendingKind = safe(data.getQueryParameter("kind"));
            pendingId = safe(data.getQueryParameter("id"));

            if (pendingId.isEmpty()) {
                Toast.makeText(this, "Fichier CDQ invalide.", Toast.LENGTH_SHORT).show();
                return;
            }

            if (getDefaultAccount().isEmpty()) {
                chooseAccount();
            } else {
                openPendingFile();
            }
        }
    }

    private void openPendingFile() {
        if (pendingId.isEmpty()) return;

        String email = getDefaultAccount();
        if (email.isEmpty()) {
            chooseAccount();
            return;
        }

        String url;
        if ("sheet".equalsIgnoreCase(pendingKind)) {
            url = "https://docs.google.com/spreadsheets/d/" +
                    Uri.encode(pendingId) +
                    "/edit?usp=drivesdk&authuser=" + Uri.encode(email) +
                    "&login_hint=" + Uri.encode(email);
        } else {
            url = "https://drive.google.com/file/d/" +
                    Uri.encode(pendingId) +
                    "/view?usp=drivesdk&authuser=" + Uri.encode(email) +
                    "&login_hint=" + Uri.encode(email);
        }

        pendingKind = "";
        pendingId = "";
        openExternalUrl(url, true);
        finish();
    }

    private void openExternalUrl(String url, boolean preferChrome) {
        Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        if (preferChrome) {
            view.setPackage("com.android.chrome");
        }

        try {
            startActivity(view);
        } catch (ActivityNotFoundException e) {
            view.setPackage(null);
            try {
                startActivity(view);
            } catch (ActivityNotFoundException ignored) {
                Toast.makeText(this, "Aucune application compatible trouvée.", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode != REQUEST_ACCOUNT) return;

        if (resultCode == RESULT_OK && data != null) {
            String email = safe(data.getStringExtra(AccountManager.KEY_ACCOUNT_NAME));
            if (!email.isEmpty()) {
                prefs.edit().putString(KEY_ACCOUNT, email).apply();
                refreshAccountLabel();

                if (!pendingId.isEmpty()) {
                    openPendingFile();
                } else {
                    Toast.makeText(this, "Compte par défaut : " + email, Toast.LENGTH_SHORT).show();
                }
                return;
            }
        }

        if (!pendingId.isEmpty()) {
            Toast.makeText(this, "Choix du compte annulé.", Toast.LENGTH_SHORT).show();
            pendingKind = "";
            pendingId = "";
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
