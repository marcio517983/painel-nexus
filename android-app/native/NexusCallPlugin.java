package com.nexusmaster.interfone.piloto;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.google.firebase.messaging.FirebaseMessaging;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name="NexusCall",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class NexusCallPlugin extends Plugin {
    @PluginMethod
    public void status(PluginCall call) {
        JSObject result=new JSObject();
        boolean enabled=NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        boolean fullScreen=Build.VERSION.SDK_INT<34 ||
            ((NotificationManager)getContext().getSystemService(Context.NOTIFICATION_SERVICE)).canUseFullScreenIntent();
        result.put("notificationEnabled",enabled);
        result.put("fullScreenEnabled",fullScreen);
        call.resolve(result);
    }
    @PluginMethod
    public void enable(PluginCall call) {
        if(Build.VERSION.SDK_INT>=33 && getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("notifications",call,"onNotificationPermission");
        }else status(call);
    }
    @PermissionCallback
    private void onNotificationPermission(PluginCall call){
        status(call);
    }
    @PluginMethod
    public void fullScreenSettings(PluginCall call) {
        if(Build.VERSION.SDK_INT>=34){
            Intent i=new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                Uri.parse("package:"+getContext().getPackageName()));
            getActivity().startActivity(i);
        }
        call.resolve();
    }
    /**
     * Return at most one direct video/audio/decline choice made in the
     * non-exported native call Activity. Query parameters cannot trigger it.
     * The WebView must check the active authenticated server-side call.
     */
    @PluginMethod
    public void consumePendingCallAction(PluginCall call) {
        String[] decision=IncomingCallController.consumeUserAction(getContext());
        JSObject result=new JSObject();
        if(decision!=null) {
            result.put("callId",decision[0]);
            result.put("action",decision[1]);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void showIncoming(PluginCall call){
        String id=call.getString("callId"),label=call.getString("label"),
               reason=call.getString("reason");
        Long expires=call.getLong("expires");
        if(!IncomingCallController.isValidId(id)||expires==null ||expires<=System.currentTimeMillis()/1000L||expires>System.currentTimeMillis()/1000L+45){
            call.reject("Chamada inválida ou expirada");return;
        }
        getActivity().runOnUiThread(()->IncomingCallController.show(getContext(),id,label,reason,expires,true));
        call.resolve();
    }
    /**
     * Route the WebRTC conversation to the phone speaker. Calling this a second
     * time after getUserMedia() keeps the default even if WebRTC reconfigures audio.
     */
    @PluginMethod
    public void preferSpeaker(PluginCall call) {
        boolean selected=IntercomAudioRoute.useSpeaker(getContext());
        JSObject result=new JSObject();
        result.put("selected",selected);
        result.put("route",selected?"speaker":"system");
        call.resolve(result);
    }
    @PluginMethod
    public void releaseSpeaker(PluginCall call) {
        IntercomAudioRoute.stop(getContext());
        call.resolve();
    }
    /** Get a Firebase registration token. Called only after a NexusMaster login. */
    @PluginMethod
    public void fcmToken(PluginCall call) {
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task->{
            if (!task.isSuccessful() || task.getResult()==null || task.getResult().isEmpty()) {
                call.reject("Não foi possível registrar este celular no Firebase.");
                return;
            }
            JSObject data=new JSObject();
            data.put("token",task.getResult());
            call.resolve(data);
        });
    }
    @PluginMethod
    public void dismiss(PluginCall call){
        String id=call.getString("callId");
        if(IncomingCallController.isValidId(id))IncomingCallController.dismiss(getContext(),id);
        call.resolve();
    }
}
