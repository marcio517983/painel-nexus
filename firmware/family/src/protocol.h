#pragma once
#include <Arduino.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <mbedtls/md.h>
#include <mbedtls/pkcs5.h>
#include <mbedtls/sha256.h>
constexpr uint32_t NX_MAGIC=0x4E585332;
enum NxType:uint8_t {NX_HELLO=1,NX_PULSE=2,NX_ACK=3,NX_TELEMETRY=4};
struct __attribute__((packed)) NxPacket {uint32_t magic;uint8_t version,type,kind,reserved;uint32_t boot,seq;char command[37];int16_t level;int8_t state,pump;uint8_t success;uint8_t auth[16];};
static_assert(sizeof(NxPacket)<=250,"ESP-NOW v1 payload overflow");
inline bool parseMac(const String&s,uint8_t*out){unsigned v[6];if(sscanf(s.c_str(),"%x:%x:%x:%x:%x:%x",&v[0],&v[1],&v[2],&v[3],&v[4],&v[5])!=6)return false;for(int i=0;i<6;i++){if(v[i]>255)return false;out[i]=v[i];}return true;}
inline bool unhex(const String&s,uint8_t*out,size_t n){if(s.length()!=n*2)return false;for(size_t i=0;i<n;i++){char b[3]={s[i*2],s[i*2+1],0};if(!isxdigit(b[0])||!isxdigit(b[1]))return false;out[i]=strtoul(b,nullptr,16);}return true;}
inline String hex(const uint8_t*b,size_t n){String s;s.reserve(n*2);for(size_t i=0;i<n;i++){char x[3];snprintf(x,3,"%02x",b[i]);s+=x;}return s;}
inline String sha(const String&s){uint8_t out[32];mbedtls_sha256_ret((const unsigned char*)s.c_str(),s.length(),out,0);return hex(out,32);}
inline String randomToken(){uint8_t bytes[32];esp_fill_random(bytes,sizeof(bytes));return hex(bytes,sizeof(bytes));}
inline bool passwordCheck(const String&password,const String&salt,const String&expected){uint8_t out[32];mbedtls_md_context_t ctx;mbedtls_md_init(&ctx);const auto* info=mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);if(mbedtls_md_setup(&ctx,info,1)!=0){mbedtls_md_free(&ctx);return false;}int r=mbedtls_pkcs5_pbkdf2_hmac(&ctx,(const unsigned char*)password.c_str(),password.length(),(const unsigned char*)salt.c_str(),salt.length(),100000,32,out);mbedtls_md_free(&ctx);if(r)return false;uint8_t expectedBytes[32];if(!unhex(expected,expectedBytes,32))return false;uint8_t diff=0;for(int i=0;i<32;i++)diff|=out[i]^expectedBytes[i];return diff==0;}
inline bool addEncryptedPeer(const uint8_t*mac,const uint8_t*key){esp_now_peer_info_t p={};memcpy(p.peer_addr,mac,6);memcpy(p.lmk,key,16);p.channel=0;p.ifidx=WIFI_IF_STA;p.encrypt=true;return esp_now_add_peer(&p)==ESP_OK;}
inline NxPacket packet(uint8_t type,uint32_t boot){NxPacket p={};p.magic=NX_MAGIC;p.version=1;p.type=type;p.boot=boot;p.level=-1;p.state=-1;p.pump=-1;return p;}

inline void nxSign(NxPacket&p,const uint8_t*key){uint8_t out[32];mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256),key,16,(const unsigned char*)&p,offsetof(NxPacket,auth),out);memcpy(p.auth,out,16);}
inline bool nxVerify(const NxPacket&p,const uint8_t*key){NxPacket check=p;nxSign(check,key);uint8_t diff=0;for(int i=0;i<16;i++)diff|=p.auth[i]^check.auth[i];return diff==0;}
