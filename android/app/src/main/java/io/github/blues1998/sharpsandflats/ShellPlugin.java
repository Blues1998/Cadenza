package io.github.blues1998.sharpsandflats;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * What the native side knows that the page cannot: that the last page died
 * and was rebuilt (MainActivity). Read once, then forgotten, so the page can
 * explain the restart a single time.
 */
@CapacitorPlugin(name = "Shell")
public class ShellPlugin extends Plugin {
    static final String PREFS = "sharpsandflats.shell";
    static final String RESTART_KEY = "restart";

    @PluginMethod
    public void takeRestart(PluginCall call) {
        JSObject out = new JSObject();
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String reason = prefs.getString(RESTART_KEY, null);
            if (reason != null) prefs.edit().remove(RESTART_KEY).apply();
            out.put("reason", reason);
        } catch (Exception e) {
            out.put("reason", (String) null);
        }
        call.resolve(out);
    }
}
