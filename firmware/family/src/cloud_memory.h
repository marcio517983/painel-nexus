#pragma once
#include <stdint.h>
// TLS allocates several buffers; total reserve and largest block are different.
// This is a preflight guard, not a guarantee that the handshake will succeed.
constexpr uint32_t CLOUD_FREE_RESERVE=85000, CLOUD_LARGEST_RESERVE=24576;
constexpr bool cloudMemoryReady(uint32_t freeBytes,uint32_t largestBlock){
 return freeBytes>=CLOUD_FREE_RESERVE&&largestBlock>=CLOUD_LARGEST_RESERVE;
}
