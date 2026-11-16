package com.nexusmaster.interfone.piloto;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Receives signed high-priority Firebase data messages while the WebView is
 * suspended. Never performs resident actions or opens gates from a Push.
 */
public final class NexusFirebaseMessagingService extends FirebaseMessagingService {
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        // No token is sent without a signed-in resident; the WebView registers it
        // through its authenticated session when opened or resumed.
        getSharedPreferences("nexus_fcm", MODE_PRIVATE).edit()
            .putLong("refresh_at", System.currentTimeMillis()).apply();
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        java.util.Map<String,String> data=message.getData();
        if (!"intercom".equals(data.get("kind"))) return;
        if (!"controws".equals(data.get("firebaseProject"))) return;
        String id=data.get("callId");
        if (!IncomingCallController.isValidId(id)) return;
        long expires;
        try { expires=Long.parseLong(data.get("expires")); }
        catch(Exception e) { return; }
        long now=System.currentTimeMillis()/1000L;
        if (expires<=now || expires>now+45L) return;
        String label=data.get("label");
        String reason=data.get("reason");
        // Native screen is opened only by an actual authenticated FCM message.
        // Android may limit full-screen behavior when battery optimizations or
        // notification permissions are restrictive.
        IncomingCallController.show(getApplicationContext(),id,label,reason,expires,false);
    }
}
