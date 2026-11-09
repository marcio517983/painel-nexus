#include <cassert>
#include "../firmware/family/src/cloud_response.h"
int main(){
 CloudResponse sink;
 const uint8_t block[1024]={};
 // Unknown/chunked length: accept precisely 32 KB, then reject without growing.
 for(int i=0;i<32;i++)assert(sink.write(block,sizeof block)==sizeof block);
 assert(sink.body.length()==32768&&!sink.failed);
 assert(sink.write(uint8_t(0))==0&&sink.failed);
 assert(sink.body.length()==32768&&sink.write(block,sizeof block)==0);
 CloudResponse declared;assert(!declared.reserve(32769)&&declared.failed);
 CloudResponse empty;assert(empty.reserve(2048));assert(empty.write(block,7)==7);
 assert(empty.body.length()==7&&empty.read()==-1&&empty.peek()==-1);
}
