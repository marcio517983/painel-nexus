package com.nexusmaster.interfone.piloto;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.SharedPreferences;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public final class IncomingCallController {
    private IncomingCallController() {}
    public static final String CHANNEL_ID = "nexus_intercom_calls_v1";
    private static final int NOTIFICATION_ID = 10201;
    private static String lastDisplayedCallId = null;
    public static final String EXTRA_CALL_ID = "nexus_call_id";
    public static final String EXTRA_LABEL = "nexus_label";
    public static final String EXTRA_REASON = "nexus_reason";
    public static final String EXTRA_EXPIRES = "nexus_expires";
    public static final String EXTRA_OPEN_CALL = "nexus_open_call";
    // The one-tap decision is recorded ONLY after a button press inside this
    // application's non-exported IncomingCallActivity. External intents, QR
    // parameters and notification payloads cannot manufacture this choice.
    private static final String ACTION_PREFS = "nexus_native_call_choice_v1";
    private static final String ACTION_ID = "call_id";
    private static final String ACTION_MODE = "choice";
    private static final String ACTION_EXPIRES = "expires";

    private static boolean isValidChoice(String action) {
        return "video".equals(action)||"audio".equals(action)||"decline".equals(action);
    }
    public static synchronized boolean recordUserAction(Context context,String id,String action,long expires) {
        final long now=System.currentTimeMillis()/1000L;
        if(!isValidId(id)||!isValidChoice(action)||expires<=now||expires>now+45L)return false;
        return context.getSharedPreferences(ACTION_PREFS,Context.MODE_PRIVATE).edit()
            .putString(ACTION_ID,id)
            .putString(ACTION_MODE,action)
            .putLong(ACTION_EXPIRES,expires)
            .commit();
    }
    /**
     * Consume at most once. The WebView must verify session, unit permission,
     * ringing status and the call deadline with the server before acting.
     */
    public static synchronized String[] consumeUserAction(Context context) {
        SharedPreferences pref=context.getSharedPreferences(ACTION_PREFS,Context.MODE_PRIVATE);
        final String id=pref.getString(ACTION_ID,null);
        final String action=pref.getString(ACTION_MODE,null);
        final long expires=pref.getLong(ACTION_EXPIRES,0L);
        pref.edit().clear().commit();
        final long now=System.currentTimeMillis()/1000L;
        if(!isValidId(id)||!isValidChoice(action)||expires<=now||expires>now+45L)return null;
        return new String[]{id,action};
    }


    public static boolean isValidId(String id) {
        return id != null && id.matches("(?i)^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$");
    }
    private static Intent incomingIntent(Context context, String callId, String label, String reason, long expires) {
        Intent intent = new Intent(context, IncomingCallActivity.class);
        intent.putExtra(EXTRA_CALL_ID, callId);
        intent.putExtra(EXTRA_LABEL, label);
        intent.putExtra(EXTRA_REASON, reason);
        intent.putExtra(EXTRA_EXPIRES, expires);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return intent;
    }
    public static synchronized void show(Context context, String callId, String label, String reason, long expires, boolean appVisible) {
        if (!isValidId(callId) || expires <= System.currentTimeMillis() / 1000L) return;
        if (expires > System.currentTimeMillis() / 1000L + 45L) return;
        // FCM and the foreground WebView may discover the same call simultaneously.
        if (callId.equals(lastDisplayedCallId)) return;
        lastDisplayedCallId = callId;
        label = label == null ? "Residência" : label.substring(0, Math.min(label.length(), 80));
        reason = reason == null ? "Chamada na portaria" : reason.substring(0, Math.min(reason.length(), 70));
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Chamadas do interfone", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Toque de chamadas recebidas do porteiro virtual NexusMaster");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 550, 250, 550});
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setSound(ringtoneUri, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build());
            manager.createNotificationChannel(channel);
        }
        Intent incoming = incomingIntent(context, callId, label, reason, expires);
        PendingIntent open = PendingIntent.getActivity(context, 202, incoming,
             PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        long remaining = Math.max(1000, (expires - System.currentTimeMillis() / 1000L) * 1000L);
        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_call_notification)
                .setContentTitle("NexusMaster • Interfone chamando")
                .setContentText(label + " • " + reason)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(open, true)
                .setContentIntent(open)
                .setAutoCancel(false)
                .setOngoing(true)
                .setTimeoutAfter(remaining)
                .setVibrate(new long[]{0,550,250,550})
                .addAction(android.R.drawable.sym_action_call, "Abrir interfone", open)
                .build();
        try {
            if (NotificationManagerCompat.from(context).areNotificationsEnabled()) {
                NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification);
            }
        } catch (SecurityException ignored) {
            // A permission denied by Android cannot be bypassed.
        }
        if (appVisible) context.startActivity(incoming);
    }
    public static synchronized void dismiss(Context context, String id) {
        if (id != null && id.equals(lastDisplayedCallId)) lastDisplayedCallId = null;
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
        IncomingCallActivity.closeIfCurrent(id);
    }
    public static Intent answerIntent(Context context, String id) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra(EXTRA_OPEN_CALL, id);
        return intent;
    }
}
