package com.nexusmaster.interfone.piloto;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;

/**
 * Select the built-in loudspeaker for two-way WebRTC calls in the Android WebView.
 * Do not force any route while the phone is only ringing. Restore audio routing
 * when the user hangs up, cancels or the containing activity is destroyed.
 */
public final class IntercomAudioRoute {
    private static boolean inCall;
    private static int savedMode = AudioManager.MODE_NORMAL;

    private IntercomAudioRoute() {}

    private static AudioManager manager(Context context) {
        return (AudioManager) context.getApplicationContext().getSystemService(Context.AUDIO_SERVICE);
    }

    public static synchronized boolean useSpeaker(Context context) {
        AudioManager audio = manager(context);
        if (audio == null) return false;
        try {
            if (!inCall) {
                savedMode = audio.getMode();
                inCall = true;
            }
            audio.setMode(AudioManager.MODE_IN_COMMUNICATION);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                for (AudioDeviceInfo device : audio.getAvailableCommunicationDevices()) {
                    if (device.isSink() && device.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                        return audio.setCommunicationDevice(device);
                    }
                }
                return false;
            }
            // Legacy routing API for Android 11 and earlier.
            audio.setSpeakerphoneOn(true);
            return audio.isSpeakerphoneOn();
        } catch (RuntimeException e) {
            return false;
        }
    }

    public static synchronized void stop(Context context) {
        if (!inCall) return;
        AudioManager audio = manager(context);
        inCall = false;
        if (audio == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                audio.clearCommunicationDevice();
            } else {
                audio.setSpeakerphoneOn(false);
            }
            if (audio.getMode() == AudioManager.MODE_IN_COMMUNICATION) {
                audio.setMode(savedMode);
            }
        } catch (RuntimeException ignored) {
            // Device vendors may reject routing changes; do not break call cleanup.
        }
    }
}
