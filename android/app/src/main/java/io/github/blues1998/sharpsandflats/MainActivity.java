package io.github.blues1998.sharpsandflats;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugins are registered before the bridge starts.
        registerPlugin(FeelPlugin.class);
        registerPlugin(ShellPlugin.class);
        super.onCreate(savedInstanceState);
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                return recoverFrom(view, detail.didCrash());
            }
        });
    }

    /**
     * The whole app runs in the WebView's renderer, a separate process. Android
     * stops it when it needs the memory back, and very rarely it crashes. Left
     * alone, either one takes the app down with it: the system closes it
     * without a word. Instead the dead view is let go and the screen rebuilt,
     * and the page, once it is back, says what happened (ShellPlugin).
     */
    private boolean recoverFrom(WebView view, boolean crashed) {
        SharedPreferences prefs = getSharedPreferences(ShellPlugin.PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        // A page that takes its renderer down every time it loads would have
        // the screen rebuilding in a loop. The second time inside a few
        // seconds, close instead; opening the app again starts clean.
        boolean looping = now - prefs.getLong(LAST_RECOVERY, 0) < 15_000;
        prefs.edit()
            .putString(ShellPlugin.RESTART_KEY, crashed ? "crashed" : "memory")
            .putLong(LAST_RECOVERY, now)
            .commit();
        if (view.getParent() instanceof ViewGroup) {
            ((ViewGroup) view.getParent()).removeView(view);
        }
        // Rebuilding destroys the old view along with the activity.
        runOnUiThread(looping ? this::finish : this::recreate);
        return true;
    }

    private static final String LAST_RECOVERY = "lastRecovery";
}
