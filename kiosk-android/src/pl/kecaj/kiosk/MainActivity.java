package pl.kecaj.kiosk;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.net.http.SslCertificate;
import android.net.http.SslError;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.Base64;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.HttpAuthHandler;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.URL;
import java.security.MessageDigest;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/**
 * Kiosk — aplikacja do panelu kiosku kecaj (kiosk-setup).
 * Panel WWW kiosku w pełnym ekranie, fizyczne przyciski głośności telefonu sterują głośnością
 * kiosku, wyszukiwanie kiosków w sieci, zapamiętany token, własny certyfikat HTTPS kiosku
 * (zaufanie po potwierdzeniu odcisku SHA-256, tylko dla tego adresu).
 */
public class MainActivity extends Activity {
    static final int BG = 0xFF0A0C08, CARD = 0xFF0F120D, FIELD = 0xFF080A06, INK = 0xFFD9DCCB, TEXT = 0xFFC2C6B4,
            MUTED = 0xFF868B78, AMBER = 0xFFF5B400, AMBERBG = 0xFF231E0C, LINE = 0xFF2C3127, BAD = 0xFFEF5B50;
    static final int FILE_REQ = 7;

    final Handler ui = new Handler(Looper.getMainLooper());
    final ExecutorService io = Executors.newCachedThreadPool();
    SharedPreferences prefs;
    WebView web;
    JSONObject kiosk;           // {url, name, user, token}
    String base;                // http(s)://host:port/
    boolean volKeys = true;
    int volAcc = 0, authTries = 0;
    ValueCallback<Uri[]> fileCb;
    final Runnable volSend = new Runnable() { public void run() { sendVolume(); } };

    // ------------------------------------------------------------------ cykl życia

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("kiosk", MODE_PRIVATE);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        volKeys = prefs.getBoolean("volkeys", true);
        JSONObject cur = current();
        if (cur == null) showSetup(null);
        else openKiosk(cur);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.getParent() != null && web.canGoBack()) web.goBack();
        else if (web == null && current() != null) openKiosk(current());
        else super.onBackPressed();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int c = e.getKeyCode();
        if (volKeys && web != null && web.getParent() != null
                && (c == KeyEvent.KEYCODE_VOLUME_UP || c == KeyEvent.KEYCODE_VOLUME_DOWN)) {
            if (e.getAction() == KeyEvent.ACTION_DOWN) {
                volAcc += c == KeyEvent.KEYCODE_VOLUME_UP ? 5 : -5;
                ui.removeCallbacks(volSend);
                ui.postDelayed(volSend, 250);   // szybkie naciśnięcia = jeden krok
            }
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == FILE_REQ && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCb = null;
        }
    }

    // ------------------------------------------------------------------ zapisane kioski

    JSONArray saved() {
        try { return new JSONArray(prefs.getString("kiosks", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    JSONObject current() {
        String u = prefs.getString("current", null);
        JSONArray a = saved();
        for (int i = 0; i < a.length(); i++) {
            JSONObject k = a.optJSONObject(i);
            if (k != null && k.optString("url").equals(u)) return k;
        }
        return null;
    }

    void save(JSONObject k) {
        JSONArray a = saved(), out = new JSONArray();
        out.put(k);
        for (int i = 0; i < a.length() && out.length() < 8; i++) {
            JSONObject o = a.optJSONObject(i);
            if (o != null && !o.optString("url").equals(k.optString("url"))) out.put(o);
        }
        prefs.edit().putString("kiosks", out.toString()).putString("current", k.optString("url")).apply();
    }

    void forget(String url) {
        JSONArray a = saved(), out = new JSONArray();
        for (int i = 0; i < a.length(); i++) {
            JSONObject o = a.optJSONObject(i);
            if (o != null && !o.optString("url").equals(url)) out.put(o);
        }
        SharedPreferences.Editor ed = prefs.edit().putString("kiosks", out.toString());
        if (url.equals(prefs.getString("current", ""))) ed.remove("current");
        ed.apply();
    }

    static String normalize(String in) {
        String s = in.trim();
        if (s.isEmpty()) return "";
        if (!s.matches("(?i)^https?://.*")) s = "http://" + s;
        Uri u = Uri.parse(s);
        String host = u.getHost();
        if (host == null || host.isEmpty()) return "";
        int port = u.getPort();
        String sch = u.getScheme().toLowerCase();
        if (port < 0) port = sch.equals("https") ? 8443 : 8088;
        String path = u.getPath() == null ? "" : u.getPath();
        if (!path.endsWith("/")) path += "/";
        return sch + "://" + (host.contains(":") ? "[" + host + "]" : host) + ":" + port + path;
    }

    String authHeader(JSONObject k) {
        String user = k.optString("user", "kiosk");
        if (user.isEmpty()) user = "kiosk";
        String raw = user + ":" + k.optString("token");
        return "Basic " + Base64.encodeToString(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8), Base64.NO_WRAP);
    }

    // ------------------------------------------------------------------ panel w WebView

    void openKiosk(JSONObject k) {
        kiosk = k;
        base = k.optString("url");
        authTries = 0;
        if (web == null) {
            web = new WebView(this);
            web.setBackgroundColor(BG);
            WebSettings s = web.getSettings();
            s.setJavaScriptEnabled(true);
            s.setDomStorageEnabled(true);
            s.setMediaPlaybackRequiresUserGesture(false);
            s.setUserAgentString(s.getUserAgentString() + " KioskApp/1.0");
            web.addJavascriptInterface(new Bridge(), "KioskApp");
            web.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                    if (fileCb != null) fileCb.onReceiveValue(null);
                    fileCb = cb;
                    try {
                        startActivityForResult(p.createIntent(), FILE_REQ);
                    } catch (Exception e) {
                        fileCb = null;
                        toast("Brak aplikacji do wyboru plików");
                        return false;
                    }
                    return true;
                }
            });
            web.setWebViewClient(new WebViewClient() {
                @Override
                public void onReceivedHttpAuthRequest(WebView v, HttpAuthHandler h, String host, String realm) {
                    if (++authTries > 2) {
                        h.cancel();
                        showSetup("Kiosk odrzucił token lub hasło — sprawdź dane logowania.");
                        return;
                    }
                    String user = kiosk.optString("user", "kiosk");
                    h.proceed(user.isEmpty() ? "kiosk" : user, kiosk.optString("token"));
                }

                @Override
                public void onPageFinished(WebView v, String url) {
                    if (url != null && url.startsWith(base)) authTries = 0;
                }

                @Override
                public void onReceivedSslError(WebView v, final SslErrorHandler h, SslError err) {
                    final String fp = fingerprint(err.getCertificate());
                    final String host = Uri.parse(base).getHost();
                    if (fp != null && fp.equals(prefs.getString("pin:" + host, null))) {
                        h.proceed();
                        return;
                    }
                    trustDialog(host, fp, new Runnable() { public void run() { h.proceed(); } },
                            new Runnable() { public void run() { h.cancel(); showSetup("Połączenie HTTPS odrzucone."); } });
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView v, String url) {
                    if (url.startsWith(base)) return false;
                    try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
                    return true;
                }

                @Override
                public void onReceivedError(WebView v, int code, String desc, String url) {
                    showError("Nie mogę połączyć się z kioskiem " + kiosk.optString("name", base) + ".\n\n" + desc
                            + "\n\nSprawdź, czy kiosk jest włączony i czy telefon jest w tej samej sieci Wi-Fi.");
                }
            });
            web.setDownloadListener(new android.webkit.DownloadListener() { public void onDownloadStart(String url, String ua, String cd, String mime, long len) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
            } });
        }
        if (web.getParent() == null) setContentView(web);
        web.loadUrl(base);
    }

    void showError(String msg) {
        LinearLayout box = column();
        box.setGravity(Gravity.CENTER_VERTICAL);
        box.addView(title("Brak połączenia"));
        TextView t = text(msg, TEXT, 15);
        box.addView(t);
        Button retry = button("Spróbuj ponownie", true);
        retry.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { openKiosk(kiosk); } });
        box.addView(retry);
        Button set = button("Ustawienia aplikacji", false);
        set.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { showSetup(null); } });
        box.addView(set);
        setContentView(scroll(box));
    }

    /** Dostęp z panelu: window.KioskApp. */
    class Bridge {
        @JavascriptInterface public void settings() { ui.post(new Runnable() { public void run() { showSetup(null); } }); }
        @JavascriptInterface public boolean volumeKeys() { return volKeys; }
        @JavascriptInterface public void setVolumeKeys(boolean on) {
            volKeys = on;
            prefs.edit().putBoolean("volkeys", on).apply();
        }
        @JavascriptInterface public String version() { return "1.0"; }
    }

    // ------------------------------------------------------------------ głośność przyciskami

    void sendVolume() {
        final int step = Math.max(-50, Math.min(50, volAcc));
        volAcc = 0;
        if (step == 0 || kiosk == null) return;
        final JSONObject k = kiosk;
        io.execute(new Runnable() { public void run() {
            String msg;
            try {
                JSONObject r = http(k, "api/audio", "{\"volume_step\":" + step + "}", 6000);
                msg = r.optString("output", r.optString("error", "Głośność"));
            } catch (Exception e) {
                msg = "Głośność: " + e.getMessage();
            }
            final String m = msg;
            ui.post(new Runnable() { public void run() {
                toast("Kiosk — " + m);
                if (web != null) web.evaluateJavascript("window.loadStatus&&loadStatus()", null);
            } });
        } });
    }

    // ------------------------------------------------------------------ HTTP (API kiosku)

    JSONObject http(JSONObject k, String path, String body, int timeout) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(k.optString("url") + path).openConnection();
        pinTls(c, Uri.parse(k.optString("url")).getHost());
        c.setConnectTimeout(timeout);
        c.setReadTimeout(timeout);
        if (k.has("token")) c.setRequestProperty("Authorization", authHeader(k));
        if (body != null) {
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            OutputStream o = c.getOutputStream();
            o.write(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            o.close();
        }
        int code = c.getResponseCode();
        InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        if (in != null) {
            byte[] b = new byte[8192];
            int n;
            while ((n = in.read(b)) > 0) buf.write(b, 0, n);
            in.close();
        }
        c.disconnect();
        String s = buf.toString("UTF-8");
        if (code == 401) throw new SecurityException("zły token lub hasło");
        JSONObject j;
        try { j = new JSONObject(s); } catch (Exception e) { j = new JSONObject(); }
        j.put("_code", code);
        if (code >= 400 && !j.has("error")) j.put("error", "błąd " + code);
        return j;
    }

    /** HTTPS z własnym certyfikatem kiosku: przyjmuj tylko certyfikat o zapamiętanym odcisku. */
    void pinTls(HttpURLConnection c, final String host) throws Exception {
        if (!(c instanceof HttpsURLConnection)) return;
        final String pin = prefs.getString("pin:" + host, null);
        if (pin == null) return;   // bez zapamiętanego odcisku: zwykła weryfikacja systemowa
        X509TrustManager tm = new X509TrustManager() {
            public void checkClientTrusted(X509Certificate[] ch, String a) { }
            public void checkServerTrusted(X509Certificate[] ch, String a) throws java.security.cert.CertificateException {
                try {
                    if (!pin.equals(hex(MessageDigest.getInstance("SHA-256").digest(ch[0].getEncoded()))))
                        throw new java.security.cert.CertificateException("inny certyfikat niż zapamiętany");
                } catch (java.security.NoSuchAlgorithmException e) {
                    throw new java.security.cert.CertificateException(e);
                }
            }
            public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
        };
        SSLContext ctx = SSLContext.getInstance("TLS");
        ctx.init(null, new TrustManager[]{tm}, null);
        HttpsURLConnection h = (HttpsURLConnection) c;
        h.setSSLSocketFactory(ctx.getSocketFactory());
        h.setHostnameVerifier(new javax.net.ssl.HostnameVerifier() { public boolean verify(String hn, javax.net.ssl.SSLSession sess) { return hn.equalsIgnoreCase(host); } });
    }

    static String fingerprint(SslCertificate cert) {
        try {
            Bundle b = SslCertificate.saveState(cert);
            byte[] der = b == null ? null : b.getByteArray("x509-certificate");
            if (der == null) return null;
            X509Certificate x = (X509Certificate) CertificateFactory.getInstance("X.509")
                    .generateCertificate(new ByteArrayInputStream(der));
            return hex(MessageDigest.getInstance("SHA-256").digest(x.getEncoded()));
        } catch (Exception e) {
            return null;
        }
    }

    static String hex(byte[] b) {
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < b.length; i++) s.append(String.format("%02X", b[i]));
        return s.toString();
    }

    void trustDialog(final String host, final String fp, final Runnable yes, final Runnable no) {
        if (fp == null) { no.run(); return; }
        StringBuilder pretty = new StringBuilder();
        for (int i = 0; i < 32 && i < fp.length(); i += 2) pretty.append(fp, i, i + 2).append(i % 16 == 14 ? "\n" : ":");
        new AlertDialog.Builder(this)
                .setTitle("Certyfikat kiosku")
                .setMessage("Kiosk " + host + " używa własnego certyfikatu HTTPS.\n\nPoczątek odcisku SHA-256:\n" + pretty
                        + "…\n\nPorównaj z panelem kiosku (System → Konta i dostęp) albo poleceniem na kiosku:\n"
                        + "openssl x509 -in /etc/kiosk-setup/tls/cert.pem -noout -fingerprint -sha256\n\n"
                        + "Zaufać temu certyfikatowi dla tego adresu?")
                .setPositiveButton("Zaufaj", new android.content.DialogInterface.OnClickListener() { public void onClick(android.content.DialogInterface d, int w) { prefs.edit().putString("pin:" + host, fp).apply(); yes.run(); } })
                .setNegativeButton("Anuluj", new android.content.DialogInterface.OnClickListener() { public void onClick(android.content.DialogInterface d, int w) { no.run(); } })
                .setOnCancelListener(new android.content.DialogInterface.OnCancelListener() { public void onCancel(android.content.DialogInterface d) { no.run(); } })
                .show();
    }

    // ------------------------------------------------------------------ ekran ustawień

    EditText addr, user, token;
    TextView status;
    LinearLayout found;

    void showSetup(String err) {
        LinearLayout box = column();
        box.addView(title("Kiosk"));
        box.addView(text("Panel kiosku kecaj na telefonie. Przyciski głośności telefonu sterują głośnością kiosku.", MUTED, 14));

        JSONArray a = saved();
        if (a.length() > 0) {
            box.addView(label("Zapisane kioski"));
            for (int i = 0; i < a.length(); i++) {
                final JSONObject k = a.optJSONObject(i);
                if (k == null) continue;
                Button b = button(k.optString("name", "Kiosk") + "\n" + k.optString("url"), false);
                b.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { save(k); openKiosk(k); } });
                b.setOnLongClickListener(new View.OnLongClickListener() { public boolean onLongClick(View v) {
                    new AlertDialog.Builder(MainActivity.this).setMessage("Usunąć z listy: " + k.optString("name") + "?")
                            .setPositiveButton("Usuń", new android.content.DialogInterface.OnClickListener() { public void onClick(android.content.DialogInterface d, int w) { forget(k.optString("url")); showSetup(null); } })
                            .setNegativeButton("Anuluj", null).show();
                    return true;
                } });
                box.addView(b);
            }
            box.addView(text("Przytrzymaj, aby usunąć z listy.", MUTED, 12));
        }

        box.addView(label("Nowy kiosk"));
        Button scan = button("Szukaj kiosków w sieci Wi-Fi", false);
        found = new LinearLayout(this);
        found.setOrientation(LinearLayout.VERTICAL);
        scan.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { scan(); } });
        box.addView(scan);
        box.addView(found);

        addr = field("Adres, np. 192.168.0.214 albo https://192.168.0.214:8443", InputType.TYPE_TEXT_VARIATION_URI);
        user = field("Użytkownik (konto domownika; puste = administrator)", InputType.TYPE_CLASS_TEXT);
        token = field("Token lub hasło", InputType.TYPE_TEXT_VARIATION_PASSWORD);
        JSONObject cur = current();
        if (cur != null) {
            addr.setText(cur.optString("url"));
            user.setText(cur.optString("user").equals("kiosk") ? "" : cur.optString("user"));
            token.setText(cur.optString("token"));
        }
        box.addView(addr);
        box.addView(user);
        box.addView(token);
        box.addView(text("Token administratora: na kiosku sudo kiosk-mode api-token (albo panel → System → Konta).", MUTED, 12));

        final CheckBox vk = new CheckBox(this);
        vk.setText("Przyciski głośności telefonu sterują kioskiem");
        vk.setTextColor(TEXT);
        vk.setChecked(volKeys);
        vk.setOnCheckedChangeListener(new android.widget.CompoundButton.OnCheckedChangeListener() { public void onCheckedChanged(android.widget.CompoundButton cb, boolean on) { volKeys = on; prefs.edit().putBoolean("volkeys", on).apply(); } });
        box.addView(vk);

        Button go = button("Połącz", true);
        go.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { connect(); } });
        box.addView(go);
        status = text(err == null ? "" : err, err == null ? MUTED : BAD, 14);
        box.addView(status);
        setContentView(scroll(box));
    }

    void connect() {
        final String url = normalize(addr.getText().toString());
        if (url.isEmpty()) { status.setTextColor(BAD); status.setText("Podaj adres kiosku."); return; }
        final JSONObject k = new JSONObject();
        try {
            k.put("url", url);
            String u = user.getText().toString().trim();
            k.put("user", u.isEmpty() ? "kiosk" : u);
            k.put("token", token.getText().toString().trim());
        } catch (Exception ignored) { }
        status.setTextColor(MUTED);
        status.setText("Łączę z " + url + " …");
        io.execute(new Runnable() { public void run() {
            String err = null;
            try {
                JSONObject ping = http(k, "api/ping", null, 5000);
                if (!ping.optBoolean("kecaj")) throw new Exception("pod tym adresem nie ma kiosku kecaj");
                k.put("name", ping.optString("name", ping.optString("hostname", "Kiosk")));
                JSONObject me = http(k, "api/me", null, 5000);
                if (me.optInt("_code") != 200) throw new Exception(me.optString("error"));
                k.put("role", me.optString("role"));
            } catch (javax.net.ssl.SSLException e) {
                err = "SSL";
            } catch (SecurityException e) {
                err = "Kiosk odrzucił token lub hasło.";
            } catch (Exception e) {
                err = "Nie udało się połączyć: " + e.getMessage();
            }
            final String fe = err;
            ui.post(new Runnable() { public void run() {
                if (fe == null) {
                    save(k);
                    toast("Połączono: " + k.optString("name"));
                    openKiosk(k);
                } else if (fe.equals("SSL")) {
                    tlsFirstUse(k);
                } else {
                    status.setTextColor(BAD);
                    status.setText(fe);
                }
            } });
        } });
    }

    /** Pierwsze połączenie HTTPS: pobierz certyfikat kiosku, pokaż odcisk, po zgodzie zapamiętaj i połącz. */
    void tlsFirstUse(final JSONObject k) {
        final String host = Uri.parse(k.optString("url")).getHost();
        io.execute(new Runnable() { public void run() {
            String fp = null;
            try {
                final X509Certificate[] got = new X509Certificate[1];
                X509TrustManager tm = new X509TrustManager() {
                    public void checkClientTrusted(X509Certificate[] ch, String a) { }
                    public void checkServerTrusted(X509Certificate[] ch, String a) { got[0] = ch[0]; }
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                };
                SSLContext ctx = SSLContext.getInstance("TLS");
                ctx.init(null, new TrustManager[]{tm}, null);
                HttpsURLConnection c = (HttpsURLConnection) new URL(k.optString("url") + "api/ping").openConnection();
                c.setSSLSocketFactory(ctx.getSocketFactory());
                c.setHostnameVerifier(new javax.net.ssl.HostnameVerifier() { public boolean verify(String hn, javax.net.ssl.SSLSession s) { return true; } });
                c.setConnectTimeout(5000);
                c.setReadTimeout(5000);
                c.getResponseCode();
                c.disconnect();
                if (got[0] != null) fp = hex(MessageDigest.getInstance("SHA-256").digest(got[0].getEncoded()));
            } catch (Exception ignored) { }
            final String f = fp;
            ui.post(new Runnable() { public void run() { trustDialog(host, f, new Runnable() { public void run() { connect(); } }, new Runnable() { public void run() {
                status.setTextColor(BAD);
                status.setText("Certyfikat HTTPS nie został zaakceptowany.");
            } }); } });
        } });
    }

    /** Szuka kiosków w sieci /24 telefonu (port 8088, /api/ping — bez logowania). */
    void scan() {
        found.removeAllViews();
        final TextView info = text("Szukam…", MUTED, 14);
        found.addView(info);
        io.execute(new Runnable() { public void run() {
            final List<String[]> hits = Collections.synchronizedList(new ArrayList<String[]>());
            List<String> prefixes = new ArrayList<>();
            try {
                for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                    if (!ni.isUp() || ni.isLoopback()) continue;
                    for (InetAddress ad : Collections.list(ni.getInetAddresses())) {
                        if (ad instanceof Inet4Address && ad.isSiteLocalAddress()) {
                            String ip = ad.getHostAddress();
                            String p = ip.substring(0, ip.lastIndexOf('.') + 1);
                            if (!prefixes.contains(p)) prefixes.add(p);
                        }
                    }
                }
            } catch (Exception ignored) { }
            ExecutorService pool = Executors.newFixedThreadPool(48);
            for (final String p : prefixes) {
                for (int i = 1; i < 255; i++) {
                    final String ip = p + i;
                    pool.execute(new Runnable() { public void run() {
                        try {
                            HttpURLConnection c = (HttpURLConnection) new URL("http://" + ip + ":8088/api/ping").openConnection();
                            c.setConnectTimeout(600);
                            c.setReadTimeout(1500);
                            if (c.getResponseCode() == 200) {
                                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                                InputStream in = c.getInputStream();
                                byte[] b = new byte[4096];
                                int n;
                                while ((n = in.read(b)) > 0) buf.write(b, 0, n);
                                JSONObject j = new JSONObject(buf.toString("UTF-8"));
                                if (j.optBoolean("kecaj"))
                                    hits.add(new String[]{ip, j.optString("name", j.optString("hostname", ip)), j.optString("version")});
                            }
                            c.disconnect();
                        } catch (Exception ignored) { }
                    } });
                }
            }
            pool.shutdown();
            try { pool.awaitTermination(30, TimeUnit.SECONDS); } catch (InterruptedException ignored) { }
            ui.post(new Runnable() { public void run() {
                found.removeAllViews();
                if (prefixes.isEmpty()) { found.addView(text("Telefon nie jest w sieci Wi-Fi.", BAD, 14)); return; }
                if (hits.isEmpty()) { found.addView(text("Nie znaleziono kiosków w sieci " + prefixes.get(0) + "0/24. Wpisz adres ręcznie.", MUTED, 14)); return; }
                for (final String[] h : hits) {
                    Button b = button(h[1] + " — " + h[0] + (h[2].isEmpty() ? "" : "  (" + h[2] + ")"), false);
                    b.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { addr.setText(h[0]); token.requestFocus(); } });
                    found.addView(b);
                }
            } });
        } });
    }

    // ------------------------------------------------------------------ widoki (bez plików XML)

    int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    LinearLayout column() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(dp(20), dp(28), dp(20), dp(28));
        l.setBackgroundColor(BG);
        return l;
    }

    ScrollView scroll(View v) {
        ScrollView s = new ScrollView(this);
        s.setFillViewport(true);
        s.setBackgroundColor(BG);
        s.addView(v);
        return s;
    }

    TextView title(String t) {
        TextView v = text(t, AMBER, 26);
        v.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        v.setPadding(0, 0, 0, dp(8));
        return v;
    }

    TextView label(String t) {
        TextView v = text(t.toUpperCase(), MUTED, 12);
        v.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        v.setLetterSpacing(0.12f);
        v.setPadding(0, dp(22), 0, dp(6));
        return v;
    }

    TextView text(String t, int color, int sp) {
        TextView v = new TextView(this);
        v.setText(t);
        v.setTextColor(color);
        v.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        v.setTypeface(Typeface.MONOSPACE);
        v.setPadding(0, dp(4), 0, dp(4));
        return v;
    }

    GradientDrawable box(int fill, int stroke) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setStroke(dp(1), stroke);
        g.setCornerRadius(dp(4));
        return g;
    }

    Button button(String t, boolean primary) {
        Button b = new Button(this);
        b.setText(t);
        b.setAllCaps(false);
        b.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        b.setTextColor(primary ? AMBER : INK);
        b.setBackground(box(primary ? AMBERBG : CARD, primary ? 0xFF7A5E12 : LINE));
        b.setMinHeight(dp(52));
        b.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        b.setPadding(dp(16), dp(10), dp(16), dp(10));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(8);
        b.setLayoutParams(lp);
        return b;
    }

    EditText field(String hint, int variation) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setHintTextColor(MUTED);
        e.setTextColor(INK);
        e.setTypeface(Typeface.MONOSPACE);
        e.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        e.setSingleLine(true);
        e.setInputType(InputType.TYPE_CLASS_TEXT | variation);
        e.setBackground(box(FIELD, LINE));
        e.setPadding(dp(14), dp(12), dp(14), dp(12));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(8);
        e.setLayoutParams(lp);
        return e;
    }

    void toast(String t) {
        Toast.makeText(this, t, Toast.LENGTH_SHORT).show();
    }
}
