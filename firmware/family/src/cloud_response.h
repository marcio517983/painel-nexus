#pragma once
#include <Arduino.h>
// HTTPClient decodes chunked transfer into this bounded sink.
class CloudResponse : public Stream {
public:
 static constexpr size_t LIMIT=32768;
 String body;bool failed=false;
 bool reserve(size_t n){if(n>LIMIT||!body.reserve(n)){failed=true;return false;}return true;}
 size_t write(uint8_t b) override{return write(&b,1);}
 size_t write(const uint8_t*data,size_t n) override{
  if(failed||n>LIMIT-body.length()||!body.concat((const char*)data,n)){failed=true;return 0;}
  return n;
 }
 int available() override{return 0;}
 int read() override{return -1;}
 int peek() override{return -1;}
 void flush() override{}
};
