#pragma once
#include <cstdint>
#include <string>
using std::size_t;
class String {
 std::string value;
public:
 bool reserve(size_t n){value.reserve(n);return true;}
 size_t length()const{return value.length();}
 bool concat(const char*data,size_t n){value.append(data,n);return true;}
};
class Stream {
public:
 virtual ~Stream()=default;
 virtual size_t write(uint8_t)=0;
 virtual size_t write(const uint8_t*,size_t)=0;
 virtual int available()=0;
 virtual int read()=0;
 virtual int peek()=0;
 virtual void flush()=0;
};
