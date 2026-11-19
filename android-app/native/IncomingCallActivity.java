package com.nexusmaster.interfone.piloto;

import android.app.Activity;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.os.Bundle;
import android.os.Build;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import java.lang.ref.WeakReference;

/**
 * Native full-screen caller ID and direct answer selector.
 * Audio/video media remains in the authenticated WebRTC WebView.
 */
public class IncomingCallActivity extends Activity {
    private static WeakReference<IncomingCallActivity> active = new WeakReference<>(null);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private MediaPlayer player;
    private long expires;
    private String callId;
    private TextView clock;
    private boolean actionSubmitted = false;

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            long remaining = expires - System.currentTimeMillis() / 1000L;
            if (remaining <= 0) { finishCall(null); return; }
            if (clock != null) clock.setText("Aguardando atendimento • " + remaining + " s");
            handler.postDelayed(this, 500);
        }
    };
    private GradientDrawable background(int color) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);g.setCornerRadius(dp(18));return g;
    }
    private TextView text(String content, int size, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(content);t.setTextSize(size);t.setTextColor(color);t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(null,Typeface.BOLD);
        return t;
    }
    private Button actionButton(String label,int color) {
        Button b = new Button(this);
        b.setText(label);b.setTextSize(17);b.setAllCaps(false);b.setTextColor(Color.WHITE);
        b.setBackground(background(color));
        return b;
    }
    private LinearLayout.LayoutParams buttonParams(){
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(58));
        p.topMargin=dp(10);
        return p;
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 27) {setShowWhenLocked(true);setTurnScreenOn(true);}
        else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.rgb(6,17,30));
        getWindow().setNavigationBarColor(Color.rgb(6,17,30));
        callId = getIntent().getStringExtra(IncomingCallController.EXTRA_CALL_ID);
        expires = getIntent().getLongExtra(IncomingCallController.EXTRA_EXPIRES,0);
        if (!IncomingCallController.isValidId(callId) || expires <= System.currentTimeMillis()/1000L) {finish();return;}
        active = new WeakReference<>(this);
        String label = getIntent().getStringExtra(IncomingCallController.EXTRA_LABEL);
        String reason = getIntent().getStringExtra(IncomingCallController.EXTRA_REASON);

        // Action buttons are pinned to the bottom even on small Android screens.
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(dp(22),dp(20),dp(22),dp(22));
        root.setBackgroundColor(Color.rgb(9,26,43));

        ScrollView information = new ScrollView(this);
        information.setFillViewport(true);
        information.setVerticalScrollBarEnabled(false);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        content.setPadding(0,dp(12),0,dp(8));
        information.addView(content);
        root.addView(information,new LinearLayout.LayoutParams(-1,0,1));

        content.addView(text("◈ N E X U S M A S T E R",16,Color.rgb(183,225,248),true));
        LinearLayout.LayoutParams iconMargin=new LinearLayout.LayoutParams(-1,-2);
        iconMargin.topMargin=dp(27);
        content.addView(text("☎",68,Color.rgb(92,196,251),true),iconMargin);
        content.addView(text("Portaria",32,Color.WHITE,true));
        LinearLayout.LayoutParams destination=new LinearLayout.LayoutParams(-1,-2);
        destination.topMargin=dp(13);
        content.addView(text(label==null?"Residência":label,21,Color.rgb(218,239,251),false),destination);
        LinearLayout.LayoutParams reasonMargin=new LinearLayout.LayoutParams(-1,-2);
        reasonMargin.topMargin=dp(10);
        content.addView(text(reason==null?"Visitante na portaria":reason,15,Color.rgb(159,195,217),false),reasonMargin);
        clock=text("",16,Color.rgb(151,193,216),false);
        LinearLayout.LayoutParams timeMargin=new LinearLayout.LayoutParams(-1,-2);
        timeMargin.topMargin=dp(25);
        content.addView(clock,timeMargin);
        content.addView(text("Escolha como deseja atender.\nO visitante não recebe sua imagem.",
            13,Color.rgb(162,201,223),false));

        LinearLayout options=new LinearLayout(this);
        options.setOrientation(LinearLayout.VERTICAL);
        root.addView(options,new LinearLayout.LayoutParams(-1,-2));
        Button video=actionButton("📹 Atender com vídeo",Color.rgb(28,130,90));
        Button audio=actionButton("🎙 Somente áudio",Color.rgb(28,102,153));
        Button decline=actionButton("✕ Recusar",Color.rgb(156,60,75));
        options.addView(video,buttonParams());
        options.addView(audio,buttonParams());
        options.addView(decline,buttonParams());
        video.setOnClickListener(view->finishCall("video"));
        audio.setOnClickListener(view->finishCall("audio"));
        decline.setOnClickListener(view->finishCall("decline"));

        setContentView(root);
        handler.post(tick);
        try {
            player=MediaPlayer.create(this,RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE));
            if(player!=null){player.setLooping(true);player.start();}
        }catch(Exception ignored){}
    }

    /**
     * The native button is the explicit user's gesture. Persist one decision in
     * private app storage for the authenticated WebView to consume only once.
     * No native path accepts/declines the call at the server or opens gates.
     */
    private void finishCall(String action) {
        if(actionSubmitted)return;
        actionSubmitted=true;
        String id=callId;
        final boolean queued=id!=null&&action!=null&&
            IncomingCallController.recordUserAction(this,id,action,expires);
        stopRingtone();
        if(queued)startActivity(IncomingCallController.answerIntent(this,id));
        if(id!=null)IncomingCallController.dismiss(this,id);
        finish();
    }
    private void stopRingtone() {
        handler.removeCallbacks(tick);
        if(player!=null){
            try {if(player.isPlaying())player.stop();player.release();}
            catch(Exception ignored){}finally{player=null;}
        }
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        stopRingtone();
        recreate();
    }
    @Override public void onDestroy(){stopRingtone();super.onDestroy();}
    public static void closeIfCurrent(String id) {
        IncomingCallActivity activity=active.get();
        if(activity!=null && id!=null && id.equals(activity.callId)){
            activity.runOnUiThread(()->{activity.stopRingtone();activity.finish();});
        }
    }
}
