#include "liquidnat/packet.hpp"
#include "liquidnat/control.hpp"
#include <algorithm>
#include <array>
#include <cassert>
extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t* data, std::size_t size) {
    liquidnat::Parsed p;
    const auto parsed = liquidnat::parse({data, size}, p);
    if (parsed == liquidnat::Reason::forwarded) {
        assert(p.family == 4 || p.family == 6);
        assert(p.l3 <= size && p.ip_size <= size - p.l3 && p.ttl > 1);
    }
    liquidnat::control::Header h;
    (void)liquidnat::control::decode({data, size}, h);
    std::array<std::uint8_t, 4096> frame{};
    const auto n = std::min(size, frame.size());
    std::copy_n(data, n, frame.begin());
    const auto before = frame;
    const auto cfg = liquidnat::lab_config();
    const auto result = liquidnat::forward({frame.data(), n}, static_cast<std::uint8_t>(size % 3), cfg);
    if (result.reason == liquidnat::Reason::forwarded) assert(result.egress < 2);
    else assert(frame == before);
    return 0;
}
