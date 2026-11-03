#pragma once
#include <stdint.h>
struct StableInput {
 bool known=false,value=false,candidate=false,started=false;uint32_t since=0;
 bool update(bool raw,uint32_t now){if(!started||raw!=candidate){candidate=raw;since=now;started=true;}if((!known||value!=candidate)&&uint32_t(now-since)>=100){known=true;value=candidate;return true;}return false;}
};
struct PumpCounter {
 uint64_t cycles=0,milliseconds=0;bool running=false,known=false,restoredRunning=false;uint32_t last=0;
 void restore(uint64_t c,uint64_t ms,bool wasRunning){cycles=c;milliseconds=ms;restoredRunning=wasRunning;}
 void tick(bool valid,bool signal,uint32_t now){if(known&&running)milliseconds+=uint32_t(now-last);last=now;if(!valid)return;if(!known){known=true;running=signal;if(signal&&!restoredRunning)cycles++;return;}if(signal&&!running)cycles++;running=signal;}
};
