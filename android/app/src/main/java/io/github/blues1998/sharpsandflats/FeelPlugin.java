package io.github.blues1998.sharpsandflats;

import android.content.Context;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The app's haptics, from Android's tuned primitives rather than raw motor
 * buzzes. A tick or a click from the composition API is shaped by the phone's
 * own haptics tuning, so it lands as a crisp tap instead of a hum.
 *
 * Each kind falls back to the predefined effects (Android 10+), and below that
 * to nothing at all: a cheap buzz is worse than no feedback.
 *
 * Played as touch feedback, so the phone's "Touch feedback" setting turns
 * these off along with the system's own.
 */
@CapacitorPlugin(name = "Feel")
public class FeelPlugin extends Plugin {
    private Vibrator vibrator;

    @Override
    public void load() {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            vibrator = manager != null ? manager.getDefaultVibrator() : null;
        } else {
            vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        String kind = call.getString("kind", "tap");
        if (vibrator != null && vibrator.hasVibrator() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            VibrationEffect effect = effectFor(kind);
            if (effect != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_TOUCH));
                } else {
                    vibrator.vibrate(effect);
                }
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void capabilities(PluginCall call) {
        JSObject out = new JSObject();
        out.put("vibrator", vibrator != null && vibrator.hasVibrator());
        out.put("composition", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && supported(VibrationEffect.Composition.PRIMITIVE_CLICK, VibrationEffect.Composition.PRIMITIVE_TICK));
        call.resolve(out);
    }

    private boolean supported(int... primitives) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return false;
        for (boolean ok : vibrator.arePrimitivesSupported(primitives)) if (!ok) return false;
        return true;
    }

    private VibrationEffect effectFor(String kind) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            VibrationEffect composed = composed(kind);
            if (composed != null) return composed;
        }
        switch (kind) {
            case "select": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK);
            case "tap": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK);
            case "success": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK);
            case "error": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK);
            case "celebrate": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK);
            default: return null;
        }
    }

    private VibrationEffect composed(String kind) {
        final int TICK = VibrationEffect.Composition.PRIMITIVE_TICK;
        final int CLICK = VibrationEffect.Composition.PRIMITIVE_CLICK;
        final int RISE = VibrationEffect.Composition.PRIMITIVE_QUICK_RISE;
        final int THUD = VibrationEffect.Composition.PRIMITIVE_THUD;
        if (!supported(TICK, CLICK)) return null;
        VibrationEffect.Composition c = VibrationEffect.startComposition();
        switch (kind) {
            // A detent: the lightest thing the motor can say.
            case "select":
                c.addPrimitive(TICK, 0.55f);
                break;
            // A button giving way under the finger.
            case "tap":
                c.addPrimitive(CLICK, 0.45f);
                break;
            // Right: two clicks, the second brighter, like a nod.
            case "success":
                c.addPrimitive(CLICK, 0.5f);
                c.addPrimitive(CLICK, 0.9f, 70);
                break;
            // Wrong: a low thud where the phone has one, two firm knocks where it does not.
            case "error":
                if (supported(THUD)) {
                    c.addPrimitive(THUD, 0.8f);
                } else {
                    c.addPrimitive(CLICK, 1.0f);
                    c.addPrimitive(CLICK, 0.7f, 90);
                }
                break;
            // A milestone: a rising swell that lands on a click.
            case "celebrate":
                if (supported(RISE)) {
                    c.addPrimitive(RISE, 0.6f);
                    c.addPrimitive(CLICK, 1.0f, 40);
                } else {
                    c.addPrimitive(CLICK, 0.4f);
                    c.addPrimitive(CLICK, 0.7f, 70);
                    c.addPrimitive(CLICK, 1.0f, 70);
                }
                break;
            default:
                return null;
        }
        return c.compose();
    }
}
