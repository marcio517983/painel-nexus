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
import android.widget.TextView;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import java.lang.ref.WeakReference;

public class IncomingCallActivity extends Activity {
    private static WeakReference<IncomingCallActivity> active = new WeakReference<>(null);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private MediaPlayer player;
    private long expires;
    private String callId;
    private TextView clock;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            long remaining = expires - System.currentTimeMillis() / 1000L;
            if (remaining <= 0) { finishCall(false); return; }
            if (clock != null) clock.setText("Aguardando atendimento • " + remaining + " s");
            handler.postDelayed(this, 500);
        }
    };
    private GradientDrawable background(int color) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);g.setCornerRadius(28f);return g;
    }
    private TextView text(String content, int size, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(content);t.setTextSize(size);t.setTextColor(color);t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(null,Typeface.BOLD);
        return t;
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
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);root.setPadding(35,40,35,40);
        root.setBackgroundColor(Color.rgb(9,26,43));
        root.addView(text("◈ N E X U S M A S T E R",18,Color.rgb(183,225,248),true));
        LinearLayout.LayoutParams margin = new LinearLayout.LayoutParams(-1,-2);
        margin.topMargin=65;
        root.addView(text("☎",72,Color.rgb(92,196,251),true), margin);
        root.addView(text("Chamada do interfone",29,Color.WHITE,true));
        LinearLayout.LayoutParams m2=new LinearLayout.LayoutParams(-1,-2);m2.topMargin=12;
        root.addView(text(label==null?"Residência":label,22,Color.rgb(218,239,251),false),m2);
        LinearLayout.LayoutParams m3=new LinearLayout.LayoutParams(-1,-2);m3.topMargin=12;
        root.addView(text(reason==null?"Visitante na portaria":reason,17,Color.rgb(159,195,217),false),m3);
        clock = text("",16,Color.rgb(151,193,216),false);
        LinearLayout.LayoutParams timeParams=new LinearLayout.LayoutParams(-1,-2);timeParams.topMargin=35;
        root.addView(clock,timeParams);
        LinearLayout buttonRow=new LinearLayout(this);buttonRow.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams rowParams=new LinearLayout.LayoutParams(-1,-2);rowParams.topMargin=70;
        Button ignore=new Button(this);ignore.setText("Ignorar");ignore.setTextColor(Color.WHITE);
        ignore.setBackground(background(Color.rgb(144,57,72)));
        Button open=new Button(this);open.setText("Abrir e atender");open.setTextColor(Color.WHITE);
        open.setBackground(background(Color.rgb(30,136,89)));
        LinearLayout.LayoutParams btn=new LinearLayout.LayoutParams(0,140,1);btn.setMargins(8,0,8,0);
        buttonRow.addView(ignore,btn);
        LinearLayout.LayoutParams btn2=new LinearLayout.LayoutParams(0,140,1);btn2.setMargins(8,0,8,0);
        buttonRow.addView(open,btn2);
        root.addView(buttonRow,rowParams);
        LinearLayout.LayoutParams noteParams=new LinearLayout.LayoutParams(-1,-2);noteParams.topMargin=20;
        root.addView(text("Toque em Abrir para entrar na central e confirmar o atendimento. Ignorar não envia recusa ao visitante.",12,Color.rgb(155,183,202),false),noteParams);
        ignore.setOnClickListener(view->finishCall(false));
        open.setOnClickListener(view->finishCall(true));
        setContentView(root);
        handler.post(tick);
        try {
            player=MediaPlayer.create(this,RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE));
            if(player!=null){player.setLooping(true);player.start();}
        }catch(Exception ignored){}
    }
    private void finishCall(boolean open) {
        String id=callId;
        stopRingtone();
        if(id!=null)IncomingCallController.dismiss(this,id);
        if(open && id!=null)startActivity(IncomingCallController.answerIntent(this,id));
        finish();
    }
    private void stopRingtone() {
        handler.removeCallbacks(tick);
        if(player!=null){
            try { if(player.isPlaying())player.stop();player.release(); }catch(Exception ignored){}
            player=null;
        }
    }
    @Override public void onDestroy(){stopRingtone();super.onDestroy();}
    public static void closeIfCurrent(String id) {
        IncomingCallActivity activity=active.get();
        if(activity!=null && id!=null && id.equals(activity.callId)){
            activity.runOnUiThread(()->{activity.stopRingtone();activity.finish();});
        }
    }
}
