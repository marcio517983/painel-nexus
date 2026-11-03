#pragma once
#include <Arduino.h>
// Support native USB and the USB-UART connector without using actuator pins.
class NexusConsole : public Print {
public:
 using Print::write;
 void begin(unsigned long baud){Serial.begin(baud);
#if ARDUINO_USB_CDC_ON_BOOT
 Serial0.begin(baud);
#endif
 }
 size_t write(uint8_t ch) override{
#if ARDUINO_USB_CDC_ON_BOOT
 if(Serial)Serial.write(ch);Serial0.write(ch);
#else
 Serial.write(ch);
#endif
 return 1;}
 int available(){return Serial.available()
#if ARDUINO_USB_CDC_ON_BOOT
 +Serial0.available()
#endif
 ;}
 int read(){
#if ARDUINO_USB_CDC_ON_BOOT
 if(Serial.available())return Serial.read();return Serial0.read();
#else
 return Serial.read();
#endif
 }
 void flush(){Serial.flush();
#if ARDUINO_USB_CDC_ON_BOOT
 Serial0.flush();
#endif
 }
} nxConsole;
#define Serial nxConsole
