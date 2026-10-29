package com.familyfinance.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Pattern;

/**
 * עדכון האפליקציה מתוך האפליקציה, בלי דפדפן: מורידה את ה-APK החדש מעמוד ה-Releases של המאגר
 * (כתובת מאושרת בלבד), ופותחת את מסך ההתקנה של אנדרואיד. אנדרואיד עצמו מוודא שהחתימה זהה
 * לאפליקציה המותקנת, ולכן הנתונים נשמרים ואי אפשר להחליף באפליקציה זרה.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private static final Pattern ALLOWED = Pattern.compile(
        "^https://github\\.com/shuey0504134506-web/family-finance/releases/download/android-v[0-9.]+/family-finance-[0-9.]+\\.apk$"
    );
    private static final long MIN_SIZE = 5L * 1024 * 1024;

    private File target() {
        File dir = new File(getContext().getCacheDir(), "updates");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return new File(dir, "family-finance-update.apk");
    }

    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url", "");
        if (url == null || !ALLOWED.matcher(url).matches()) {
            call.reject("bad-url");
            return;
        }
        new Thread(() -> {
            File file = target();
            File part = new File(file.getParentFile(), "download.part");
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(30000);
                int code = conn.getResponseCode();
                if (code != 200) {
                    call.reject("http-" + code);
                    return;
                }
                long total = conn.getContentLengthLong();
                long done = 0;
                int lastPercent = -1;
                try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(part)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            int percent = (int) (done * 100 / total);
                            if (percent != lastPercent) {
                                lastPercent = percent;
                                JSObject ev = new JSObject();
                                ev.put("percent", percent);
                                notifyListeners("progress", ev);
                            }
                        }
                    }
                }
                if (part.length() < MIN_SIZE || (total > 0 && part.length() != total)) {
                    //noinspection ResultOfMethodCallIgnored
                    part.delete();
                    call.reject("incomplete");
                    return;
                }
                //noinspection ResultOfMethodCallIgnored
                file.delete();
                if (!part.renameTo(file)) {
                    call.reject("rename-failed");
                    return;
                }
                call.resolve();
            } catch (Exception e) {
                //noinspection ResultOfMethodCallIgnored
                part.delete();
                call.reject("download-failed");
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    /** האם מותר לאפליקציה להתקין עדכונים (באנדרואיד 8 ומעלה: "התקנה ממקורות לא ידועים" לאפליקציה הזו). */
    @PluginMethod
    public void canInstall(PluginCall call) {
        Context ctx = getContext();
        JSObject result = new JSObject();
        result.put("granted", Build.VERSION.SDK_INT < Build.VERSION_CODES.O || ctx.getPackageManager().canRequestPackageInstalls());
        call.resolve(result);
    }

    /** פותחת את מסך ההרשאה של המערכת. אחרי האישור המשתמש חוזר, וההתקנה ממשיכה. */
    @PluginMethod
    public void requestInstallPermission(PluginCall call) {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(settings);
        }
        call.resolve();
    }

    @PluginMethod
    public void install(PluginCall call) {
        Context ctx = getContext();
        File file = target();
        if (!file.exists() || file.length() < MIN_SIZE || !looksLikeApk(file)) {
            call.reject("no-file");
            return;
        }
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !ctx.getPackageManager().canRequestPackageInstalls()) {
            // פעם ראשונה: צריך לאשר לאפליקציה להתקין עדכונים (מסך הגדרות של המערכת)
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(settings);
            result.put("needsPermission", true);
            call.resolve(result);
            return;
        }
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", file);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
        result.put("needsPermission", false);
        call.resolve(result);
    }

    /** קובץ APK הוא ארכיון ZIP: מתחיל ב-"PK". */
    private boolean looksLikeApk(File file) {
        try (FileInputStream in = new FileInputStream(file)) {
            return in.read() == 'P' && in.read() == 'K';
        } catch (Exception e) {
            return false;
        }
    }
}
