package pl.kecaj.kiosk;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.media.VolumeProvider;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Odtwarzacz kiosku w systemie Android: powiadomienie z okładką i przyciskami (także na ekranie
 * blokady), sesja multimediów (słuchawki, zegarek, Android Auto) i głośność kiosku z przycisków
 * telefonu jak przy Chromecaście — także gdy aplikacja jest w tle albo ekran jest zablokowany.
 * Muzyka gra na kiosku; telefon tylko steruje i pokazuje, co gra.
 */
public class MediaService extends Service {
    static final String CH = "kiosk_player";
    static final int NID = 42;
    static final String A_TOGGLE = "pl.kecaj.kiosk.TOGGLE", A_NEXT = "pl.kecaj.kiosk.NEXT",
            A_PREV = "pl.kecaj.kiosk.PREV", A_CLOSE = "pl.kecaj.kiosk.CLOSE", A_REFRESH = "pl.kecaj.kiosk.REFRESH";

    final Handler ui = new Handler(Looper.getMainLooper());
    final ExecutorService io = Executors.newSingleThreadExecutor();
    SharedPreferences prefs;
    MediaSession session;
    VolumeProvider volume;
    JSONObject kiosk;
    String kioskName = "Kiosk", title = "", sub = "", artKey = "";
    Bitmap art;
    boolean playing, started, polling;
    int vol = 50, volStep = 0;

    final Runnable poll = new Runnable() { public void run() { refresh(); } };
    final Runnable sendVol = new Runnable() { public void run() {
        final int s = volStep; volStep = 0;
        if (s != 0) command("api/audio", "{\"volume_step\":" + s + "}");
    } };

    /** Włącza odtwarzacz (z aplikacji). */
    static void start(Context ctx) {
        Intent i = new Intent(ctx, MediaService.class).setAction(A_REFRESH);
        try {
            if (Build.VERSION.SDK_INT >= 26)
                Context.class.getMethod("startForegroundService", Intent.class).invoke(ctx, i);
            else ctx.startService(i);
        } catch (Exception e) {
            try { ctx.startService(i); } catch (Exception ignored) { }
        }
    }

    static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, MediaService.class));
    }

    @Override
    public IBinder onBind(Intent i) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = getSharedPreferences("kiosk", MODE_PRIVATE);
        createChannel();
        session = new MediaSession(this, "Kiosk");
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { if (!playing) command("api/audio/toggle", "{}"); }
            @Override public void onPause() { if (playing) command("api/audio/toggle", "{}"); }
            @Override public void onStop() { if (playing) command("api/audio/toggle", "{}"); }
            @Override public void onSkipToNext() { command("api/radio/step", "{\"dir\":1}"); }
            @Override public void onSkipToPrevious() { command("api/radio/step", "{\"dir\":-1}"); }
        });
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        session.setSessionActivity(PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        // Głośność kiosku jako głośność zdalnego odtwarzania: przyciski telefonu i suwak systemowy.
        volume = new VolumeProvider(VolumeProvider.VOLUME_CONTROL_ABSOLUTE, 100, vol) {
            @Override public void onSetVolumeTo(int v) {
                setCurrentVolume(v);
                command("api/audio", "{\"volume\":" + Math.max(0, Math.min(100, v)) + "}");
            }
            @Override public void onAdjustVolume(int dir) {
                if (dir == 0) return;
                volStep += dir > 0 ? 5 : -5;
                setCurrentVolume(Math.max(0, Math.min(100, getCurrentVolume() + (dir > 0 ? 5 : -5))));
                ui.removeCallbacks(sendVol);
                ui.postDelayed(sendVol, 250);
            }
        };
        session.setPlaybackToRemote(volume);
        session.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!started) {
            started = true;
            startForeground(NID, build());     // od razu — Android wymaga tego po startForegroundService
        }
        String a = intent == null ? null : intent.getAction();
        kiosk = MainActivity.currentKiosk(prefs);
        if (kiosk == null || A_CLOSE.equals(a)) {
            if (A_CLOSE.equals(a)) prefs.edit().putBoolean("player", false).apply();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        kioskName = kiosk.optString("name", "Kiosk");
        if (A_TOGGLE.equals(a)) command("api/audio/toggle", "{}");
        else if (A_NEXT.equals(a)) command("api/radio/step", "{\"dir\":1}");
        else if (A_PREV.equals(a)) command("api/radio/step", "{\"dir\":-1}");
        else refresh();
        if (!polling) { polling = true; ui.postDelayed(poll, 4000); }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        polling = false;
        ui.removeCallbacksAndMessages(null);
        if (session != null) { session.setActive(false); session.release(); }
        io.shutdownNow();
        super.onDestroy();
    }

    /** Polecenie do kiosku, potem odświeżenie stanu. */
    void command(final String path, final String body) {
        final JSONObject k = kiosk;
        if (k == null) return;
        io.execute(new Runnable() { public void run() {
            try { MainActivity.httpS(prefs, k, path, body, 8000); } catch (Exception ignored) { }
            try { Thread.sleep(700); } catch (InterruptedException ignored) { }
            fetch();
        } });
    }

    void refresh() {
        io.execute(new Runnable() { public void run() { fetch(); } });
        if (polling) {
            ui.removeCallbacks(poll);
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            boolean screenOn = pm == null || pm.isInteractive();
            ui.postDelayed(poll, screenOn ? 4000 : 15000);
        }
    }

    /** Stan kiosku → sesja multimediów i powiadomienie (wątek w tle). */
    void fetch() {
        final JSONObject k = kiosk;
        if (k == null) return;
        try {
            JSONObject st = MainActivity.httpS(prefs, k, "api/status", null, 6000);
            if (st.optInt("_code") != 200) return;
            JSONObject np = st.optJSONObject("now_playing");
            JSONObject au = st.optJSONObject("audio");
            boolean pl = np != null && "playing".equals(np.optString("state"));
            String t = np == null ? "" : np.optString("title");
            if (t.matches("(?i)^[a-z]+://.*")) t = "";
            String station = np == null ? "" : np.optString("station");
            String artist = np == null ? "" : np.optString("artist");
            String name = st.optString("name", kioskName);
            String nt = pl ? (t.isEmpty() ? (station.isEmpty() ? "Gra" : station) : t) : "Cisza";
            StringBuilder s = new StringBuilder();
            if (pl && !artist.isEmpty()) s.append(artist);
            if (pl && !station.isEmpty() && !station.equals(nt)) s.append(s.length() > 0 ? " · " : "").append(station);
            final int v = au != null && !au.isNull("volume") ? au.optInt("volume", vol) : vol;
            Bitmap newArt = art;
            String key = pl && np.optBoolean("art") ? nt + "|" + artist : "";
            if (!key.equals(artKey)) {
                newArt = null;
                if (!key.isEmpty()) {
                    byte[] b = MainActivity.getBytes(prefs, k, "api/nowplaying/art", 8000, 3_000_000);
                    if (b != null) newArt = BitmapFactory.decodeByteArray(b, 0, b.length);
                }
            }
            final String fKey = key, fTitle = nt, fSub = s.toString(), fName = name;
            final boolean fPl = pl;
            final Bitmap fArt = newArt;
            ui.post(new Runnable() { public void run() {
                artKey = fKey; art = fArt; title = fTitle; sub = fSub; kioskName = fName; playing = fPl; vol = v;
                if (volStep == 0) volume.setCurrentVolume(v);
                update();
            } });
        } catch (Exception ignored) { }
    }

    void update() {
        MediaMetadata.Builder m = new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, sub.isEmpty() ? "Kiosk " + kioskName : sub)
                .putString(MediaMetadata.METADATA_KEY_ALBUM, "Kiosk " + kioskName);
        if (art != null) m.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, art);
        session.setMetadata(m.build());
        session.setPlaybackState(new PlaybackState.Builder()
                .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE
                        | PlaybackState.ACTION_STOP | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS)
                .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                        PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f)
                .build());
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NID, build());
    }

    PendingIntent action(String a, int code) {
        Intent i = new Intent(this, MediaService.class).setAction(a);
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                return (PendingIntent) PendingIntent.class.getMethod("getForegroundService", Context.class, int.class, Intent.class, int.class)
                        .invoke(null, this, code, i, fl);
            } catch (Exception ignored) { }
        }
        return PendingIntent.getService(this, code, i, fl);
    }

    @SuppressWarnings("deprecation")
    Notification build() {
        Notification.Builder b = new Notification.Builder(this);
        if (Build.VERSION.SDK_INT >= 26) {
            try { Notification.Builder.class.getMethod("setChannelId", String.class).invoke(b, CH); } catch (Exception ignored) { }
        }
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        b.setSmallIcon(playing ? android.R.drawable.ic_media_play : android.R.drawable.ic_media_pause)
                .setContentTitle(title.isEmpty() ? "Kiosk " + kioskName : title)
                .setContentText(sub.isEmpty() ? "Kiosk " + kioskName : sub)
                .setSubText("Kiosk " + kioskName)
                .setContentIntent(PendingIntent.getActivity(this, 2, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
                .setOngoing(true)
                .setShowWhen(false)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setColor(0xFFF5B400)
                .addAction(android.R.drawable.ic_media_previous, "Poprzednia", action(A_PREV, 11))
                .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                        playing ? "Pauza" : "Graj", action(A_TOGGLE, 12))
                .addAction(android.R.drawable.ic_media_next, "Następna", action(A_NEXT, 13))
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Zamknij", action(A_CLOSE, 14))
                .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2));
        if (art != null) b.setLargeIcon(art);
        return b.build();
    }

    void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        try {
            Class<?> c = Class.forName("android.app.NotificationChannel");
            Object ch = c.getConstructor(String.class, CharSequence.class, int.class).newInstance(CH, "Odtwarzacz kiosku", 2);
            c.getMethod("setShowBadge", boolean.class).invoke(ch, false);
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            NotificationManager.class.getMethod("createNotificationChannel", c).invoke(nm, ch);
        } catch (Exception ignored) { }
    }
}
