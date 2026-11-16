package com.nexusmaster.interfone.piloto;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state){
        registerPlugin(NexusCallPlugin.class);
        super.onCreate(state);
        openCall(getIntent());
    }
    @Override public void onDestroy(){
        IntercomAudioRoute.stop(this);
        super.onDestroy();
    }
    @Override protected void onNewIntent(Intent intent){
        super.onNewIntent(intent);
        setIntent(intent);
        openCall(intent);
    }
    private void openCall(Intent intent){
        if(intent==null)return;
        String callId=intent.getStringExtra(IncomingCallController.EXTRA_OPEN_CALL);
        if(!IncomingCallController.isValidId(callId))return;
        if(getBridge()==null||getBridge().getWebView()==null)return;
        final String url="https://painel-nexus-nexus-iot-git-feature-interfon-a7cfd6-controws-iot.vercel.app/interfone-morador.html?call="+callId;
        getBridge().getWebView().post(()->getBridge().getWebView().loadUrl(url));
        intent.removeExtra(IncomingCallController.EXTRA_OPEN_CALL);
    }
}
