package au.com.docked.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.ByteBuffer;

@CapacitorPlugin(name = "DockedPullImage")
public class DockedPullImagePlugin extends Plugin {
    private static final long CACHE_AGE_MS = 24L * 60 * 60 * 1000;
    private static final int MAX_BASE64_LENGTH = 8 * 1024 * 1024;
    private static final long PNG_SIGNATURE = 0x89504e470d0a1a0aL;
    private static final int PNG_IHDR = 0x49484452;

    private static byte[] image(PluginCall call) {
        String encoded = call.getString("data");
        if (encoded == null || encoded.length() > MAX_BASE64_LENGTH) {
            throw new IllegalArgumentException("Image is missing or too large");
        }
        byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
        if (bytes.length < 24) {
            throw new IllegalArgumentException("Image header is missing");
        }
        ByteBuffer header = ByteBuffer.wrap(bytes);
        if (header.getLong() != PNG_SIGNATURE || header.getInt() != 13
                || header.getInt() != PNG_IHDR || header.getInt() != 1080 || header.getInt() != 1920) {
            throw new IllegalArgumentException("Invalid pull image");
        }
        return bytes;
    }

    @PluginMethod
    public void prepareShare(PluginCall call) {
        try {
            byte[] bytes = image(call);
            File folder = new File(getContext().getCacheDir(), "docked-pulls");
            if (!folder.isDirectory() && !folder.mkdirs()) {
                throw new IOException("Share cache unavailable");
            }
            File[] oldImages = folder.listFiles();
            if (oldImages != null) {
                long cutoff = System.currentTimeMillis() - CACHE_AGE_MS;
                for (File old : oldImages) {
                    if (old.isFile() && old.lastModified() < cutoff) old.delete();
                }
            }
            File file = File.createTempFile("docked-pull-", ".png", folder);
            try (FileOutputStream output = new FileOutputStream(file)) {
                output.write(bytes);
            } catch (IOException e) {
                file.delete();
                throw e;
            }
            JSObject response = new JSObject();
            response.put("uri", Uri.fromFile(file).toString());
            call.resolve(response);
        } catch (IllegalArgumentException | IOException e) {
            call.reject("The pull image could not be prepared.");
        }
    }

    @PluginMethod
    public void save(PluginCall call) {
        try {
            image(call);
            String filename = call.getString("filename", "");
            if (!filename.matches("docked-[a-z-]{1,40}-pull\\.png")) {
                throw new IllegalArgumentException("Invalid image filename");
            }
            Intent destination = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("image/png")
                    .putExtra(Intent.EXTRA_TITLE, filename);
            getActivity().runOnUiThread(() -> {
                try {
                    startActivityForResult(call, destination, "saveResult");
                } catch (RuntimeException e) {
                    call.reject("A save location could not be opened.");
                }
            });
        } catch (IllegalArgumentException e) {
            call.reject("The pull image is invalid.");
        }
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        JSObject response = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            response.put("saved", false);
            call.resolve(response);
            return;
        }
        try (OutputStream output = getContext().getContentResolver().openOutputStream(uri)) {
            if (output == null) throw new IOException("Save location is unavailable");
            output.write(image(call));
            response.put("saved", true);
        } catch (IllegalArgumentException | IOException | SecurityException e) {
            call.reject("The pull image could not be saved.");
            return;
        }
        call.resolve(response);
    }
}
