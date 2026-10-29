package com.familyfinance.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * שמירת קובץ ישר לתיקיית ההורדות של הטלפון (Download/ניהול כספים), בלי חלון שיתוף ובלי הרשאות.
 * קובץ באותו שם מחליף את הקודם, כך שגיבוי אוטומטי תמיד נשאר קובץ אחד עדכני.
 */
@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {

    private static final String FOLDER = "ניהול כספים";

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name", "");
        String data = call.getString("data", "");
        String mime = call.getString("mime", "application/octet-stream");
        boolean base64 = Boolean.TRUE.equals(call.getBoolean("base64", false));
        if (name == null || name.isEmpty() || name.contains("/") || name.contains("\\") || name.contains("..")) {
            call.reject("bad-name");
            return;
        }
        final byte[] bytes;
        try {
            bytes = base64 ? Base64.decode(data, Base64.DEFAULT) : data.getBytes(StandardCharsets.UTF_8);
        } catch (Exception e) {
            call.reject("bad-data");
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveWithMediaStore(name, mime, bytes);
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), FOLDER);
                if (!dir.exists() && !dir.mkdirs()) {
                    call.reject("no-folder");
                    return;
                }
                try (OutputStream out = new FileOutputStream(new File(dir, name))) {
                    out.write(bytes);
                }
            }
            JSObject result = new JSObject();
            result.put("path", "Download/" + FOLDER + "/" + name);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("save-failed");
        }
    }

    private void saveWithMediaStore(String name, String mime, byte[] bytes) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
        String relative = Environment.DIRECTORY_DOWNLOADS + "/" + FOLDER;
        try {
            // מוחקים עותק קודם של האפליקציה באותו שם, כדי שלא יצטברו "(1)", "(2)"
            resolver.delete(
                collection,
                MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " + MediaStore.MediaColumns.RELATIVE_PATH + "=?",
                new String[] { name, relative + "/" }
            );
        } catch (Exception ignored) {
            // קובץ שאינו שלנו (אחרי התקנה מחדש): נשמר לצידו
        }
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, relative);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = resolver.insert(collection, values);
        if (uri == null) throw new Exception("insert-failed");
        try (OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null) throw new Exception("no-stream");
            out.write(bytes);
        }
        ContentValues done = new ContentValues();
        done.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, done, null, null);
    }
}
