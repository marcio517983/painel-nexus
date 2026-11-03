#pragma once
#include <esp_now.h>
#include <esp_wifi.h>
#include <mbedtls/md.h>
#include <time.h>
#include <sys/time.h>
constexpr uint32_t RADIO_MAGIC=0x4e585033;
enum RadioType:uint8_t{R_STATUS=1,R_HELLO=2,R_PULSE=3,R_ACK=4};
struct __attribute__((packed)) RadioFrame{uint32_t magic=RADIO_MAGIC;uint8_t version=3,type=0,channel=0,success=0;uint32_t senderBoot=0,targetBoot=0,sequence=0,expires=0,pulseMs=0;char command[37]={};int8_t states[4]={-1,-1,-1,-1};uint8_t outputs=0;int8_t pump=-1;uint64_t cycles=0,runtimeSeconds=0;char counterEpoch[33]={};uint8_t auth[16]={};};
static_assert(sizeof(RadioFrame)<=250,"Radio payload exceeds ESP-NOW v1");
void radioSign(RadioFrame&f,const uint8_t*key){uint8_t h[32];mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256),key,16,(const uint8_t*)&f,offsetof(RadioFrame,auth),h);memcpy(f.auth,h,16);}
bool radioValid(const RadioFrame&f,const uint8_t*key){if(f.magic!=RADIO_MAGIC||f.version!=3)return false;auto check=f;radioSign(check,key);uint8_t d=0;for(int i=0;i<16;i++)d|=f.auth[i]^check.auth[i];return d==0;}
