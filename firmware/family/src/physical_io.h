#pragma once
#include <Arduino.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <freertos/timers.h>
#include "sensor_logic.h"
#if NX_C3
constexpr uint8_t CHANNELS=2;constexpr uint8_t OUT_PINS[]={0,1},REED_PINS[]={3,4};constexpr int PUMP_PIN=-1;
#elif NX_S3
constexpr uint8_t CHANNELS=4;constexpr uint8_t OUT_PINS[]={4,21,16,17},REED_PINS[]={5,6,7,15};constexpr int PUMP_PIN=18;
#else
constexpr uint8_t CHANNELS=4;constexpr uint8_t OUT_PINS[]={25,23,26,27},REED_PINS[]={32,33,34,35};constexpr int PUMP_PIN=13;
#endif
Preferences ioPrefs;TimerHandle_t outputTimers[CHANNELS];volatile bool outputDone[CHANNELS]={};
bool outputBusy[CHANNELS]={};uint8_t enabledMask=0,reedMask=0;bool pumpEnabled=false;
StableInput reeds[CHANNELS],pumpInput;PumpCounter pumpCounter;String counterEpoch;
uint32_t lastCheckpoint=0;char recentCommands[16][37]={};uint8_t recentIndex=0;
void stopOutput(TimerHandle_t timer){int i=(int)(uintptr_t)pvTimerGetTimerID(timer);digitalWrite(OUT_PINS[i],HIGH);outputDone[i]=true;}
void ioBegin(){
 ioPrefs.begin("nx-physical",false);enabledMask=ioPrefs.getUChar("outputs",0)&((1<<CHANNELS)-1);reedMask=ioPrefs.getUChar("reeds",0)&((1<<CHANNELS)-1);pumpEnabled=PUMP_PIN>=0&&ioPrefs.getBool("pumpEnable",false);
 for(int i=0;i<CHANNELS;i++){digitalWrite(OUT_PINS[i],HIGH);pinMode(OUT_PINS[i],OUTPUT_OPEN_DRAIN);outputTimers[i]=xTimerCreate("pulseOff",pdMS_TO_TICKS(1000),pdFALSE,(void*)(uintptr_t)i,stopOutput);pinMode(REED_PINS[i],REED_PINS[i]>=34&&REED_PINS[i]<=39?INPUT:INPUT_PULLUP);}
 if(PUMP_PIN>=0)pinMode(PUMP_PIN,INPUT_PULLUP);
 counterEpoch=ioPrefs.getString("counterEpoch","");if(counterEpoch.length()!=32){uint8_t bytes[16];esp_fill_random(bytes,16);char text[33];for(int i=0;i<16;i++)sprintf(text+i*2,"%02x",bytes[i]);counterEpoch=text;ioPrefs.putString("counterEpoch",counterEpoch);}
 pumpCounter.restore(ioPrefs.getULong64("cycles",0),ioPrefs.getULong64("runtimeMs",0),ioPrefs.getBool("wasRunning",false));
 ioPrefs.getBytes("recent",recentCommands,sizeof(recentCommands));recentIndex=ioPrefs.getUChar("recentIndex",0)%16;
}
bool physicalConfig(JsonVariant d){if(!d["enabledMask"].is<unsigned>()||d["enabledMask"].as<unsigned>()>=(1u<<CHANNELS)||!d["reedMask"].is<unsigned>()||d["reedMask"].as<unsigned>()>=(1u<<CHANNELS)||(PUMP_PIN<0&&d["pumpEnabled"].as<bool>()))return false;ioPrefs.putUChar("outputs",d["enabledMask"]);ioPrefs.putUChar("reeds",d["reedMask"]);ioPrefs.putBool("pumpEnable",d["pumpEnabled"].as<bool>());return true;}
bool rememberCommand(const String&id){if(id.length()!=36)return false;for(auto&x:recentCommands)if(id==x)return false;strlcpy(recentCommands[recentIndex],id.c_str(),37);recentIndex=(recentIndex+1)%16;return ioPrefs.putBytes("recent",recentCommands,sizeof(recentCommands))==sizeof(recentCommands)&&ioPrefs.putUChar("recentIndex",recentIndex)>0;}
bool startOutput(int i,const String&id,uint32_t duration){if(i<0||i>=CHANNELS||!(enabledMask&(1<<i))||outputBusy[i]||!outputTimers[i]||duration<100||duration>5000||!rememberCommand(id))return false;outputDone[i]=false;outputBusy[i]=true;if(xTimerChangePeriod(outputTimers[i],pdMS_TO_TICKS(duration),0)!=pdPASS){outputBusy[i]=false;return false;}digitalWrite(OUT_PINS[i],LOW);return true;}
void ioTick(){uint32_t now=millis();for(int i=0;i<CHANNELS;i++)if(reedMask&(1<<i))reeds[i].update(digitalRead(REED_PINS[i])==LOW,now);if(pumpEnabled){bool changed=pumpInput.update(digitalRead(PUMP_PIN)==LOW,now);pumpCounter.tick(pumpInput.known,pumpInput.value,now);if(changed||now-lastCheckpoint>=60000){ioPrefs.putULong64("cycles",pumpCounter.cycles);ioPrefs.putULong64("runtimeMs",pumpCounter.milliseconds);ioPrefs.putBool("wasRunning",pumpCounter.running);lastCheckpoint=now;}}}
int reedState(int i){return i>=0&&i<CHANNELS&&(reedMask&(1<<i))&&reeds[i].known?(reeds[i].value?0:1):-1;}
void writePump(JsonObject n){n["pump"]=pumpEnabled&&pumpCounter.known?(pumpCounter.running?1:0):-1;n["cycles"]=pumpCounter.cycles;n["runtimeSeconds"]=pumpCounter.milliseconds/1000;n["counterEpoch"]=counterEpoch;n["level"]=-1;}
