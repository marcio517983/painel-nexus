#pragma once
#include <stdint.h>
// TLS allocates several buffers; total reserve and largest block are different.
// This is a preflight guard, not a guarantee that the handshake will succeed.
constexpr uint32_t CLOUD_FREE_RESERVE=85000, CLOUD_LARGEST_RESERVE=24576;
constexpr bool cloudMemoryReady(uint32_t freeBytes,uint32_t largestBlock){
 return freeBytes>=CLOUD_FREE_RESERVE&&largestBlock>=CLOUD_LARGEST_RESERVE;
}

// Leave room for allocator metadata and concurrent serial/Wi-Fi work.
// A fixed 48000-byte JSON pool fails when the largest free block is only 47 KB.
constexpr uint32_t cloudResponseCapacity(uint32_t largestBlock){
 return largestBlock<6144?0:(largestBlock-2048<48000?largestBlock-2048:48000);
}
