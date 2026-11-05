#include "liquidnat/packet.hpp"
#include <algorithm>

namespace liquidnat {
std::uint16_t read16(ConstBytes b, std::size_t at) noexcept {
    return static_cast<std::uint16_t>((static_cast<unsigned>(b[at]) << 8U) | b[at + 1]);
}
std::uint16_t checksum(ConstBytes b) noexcept {
    std::uint32_t sum = 0;
    for (std::size_t i = 0; i + 1 < b.size(); i += 2) sum += read16(b, i);
    if ((b.size() & 1U) != 0) sum += static_cast<std::uint32_t>(b.back()) << 8U;
    while ((sum >> 16U) != 0) sum = (sum & 0xffffU) + (sum >> 16U);
    return static_cast<std::uint16_t>(~sum);
}
Reason parse(ConstBytes f, Parsed& p) noexcept {
    p = {};
    if (f.size() < 14) return Reason::truncated;
    auto type = read16(f, 12);
    std::size_t offset = 14;
    unsigned tags = 0;
    while (type == 0x8100 || type == 0x88a8) {
        if (++tags > 2) return Reason::vlan_depth;
        if (f.size() - offset < 4) return Reason::truncated;
        type = read16(f, offset + 2);
        offset += 4;
    }
    p.l3 = offset;
    const auto ip = f.subspan(offset);
    if (type == 0x0800) {
        if (ip.size() < 20) return Reason::truncated;
        if ((ip[0] >> 4U) != 4) return Reason::ip_version;
        const auto ihl = static_cast<std::size_t>(ip[0] & 15U) * 4;
        if (ihl < 20) return Reason::ip_length;
        if (ip.size() < ihl) return Reason::truncated;
        p.ip_size = read16(ip, 2);
        if (p.ip_size < ihl || p.ip_size > ip.size()) return Reason::ip_length;
        if (checksum(ip.first(ihl)) != 0) return Reason::checksum;
        if (ihl != 20) return Reason::ip_options;
        const auto frag = read16(ip, 6);
        if ((frag & 0xbfffU) != 0) return Reason::fragment; // DF alone is allowed.
        p.family = 4; p.ttl = ip[8]; p.protocol = ip[9];
        std::copy_n(ip.begin() + 12, 4, p.source.begin());
        std::copy_n(ip.begin() + 16, 4, p.destination.begin());
        if (p.source[0] == 0 || p.source[0] == 127 || p.source[0] >= 224)
            return Reason::invalid_source;
    } else if (type == 0x86dd) {
        if (ip.size() < 40) return Reason::truncated;
        if ((ip[0] >> 4U) != 6) return Reason::ip_version;
        const auto payload = read16(ip, 4);
        if (payload == 0) return Reason::ip_length; // Jumbograms unsupported.
        p.ip_size = static_cast<std::size_t>(payload) + 40;
        if (p.ip_size > ip.size()) return Reason::ip_length;
        p.family = 6; p.protocol = ip[6]; p.ttl = ip[7];
        if (p.protocol == 0 || p.protocol == 43 || p.protocol == 44 || p.protocol == 50 ||
            p.protocol == 51 || p.protocol == 60 || p.protocol == 135)
            return Reason::extension;
        std::copy_n(ip.begin() + 8, 16, p.source.begin());
        std::copy_n(ip.begin() + 24, 16, p.destination.begin());
        const bool unspecified = std::all_of(p.source.begin(), p.source.end(), [](auto x) { return x == 0; });
        const bool loopback = std::all_of(p.source.begin(), p.source.end() - 1, [](auto x) { return x == 0; }) && p.source.back() == 1;
        if (unspecified || loopback || p.source[0] == 0xff ||
            (p.source[0] == 0xfe && (p.source[1] & 0xc0U) == 0x80)) return Reason::invalid_source;
    } else return Reason::ether_type;
    if (p.ttl <= 1) return Reason::hop_limit;
    return Reason::forwarded;
}
static bool matches(const Address& address, const Route& route) noexcept {
    const auto bits = route.family == 4 ? 32U : 128U;
    if (route.prefix_length > bits) return false;
    const auto full = static_cast<std::size_t>(route.prefix_length / 8);
    if (!std::equal(address.begin(), address.begin() + static_cast<std::ptrdiff_t>(full), route.prefix.begin())) return false;
    const auto rem = route.prefix_length % 8;
    if (rem == 0) return true;
    const auto mask = static_cast<std::uint8_t>(0xffU << (8 - rem));
    return (address[full] & mask) == (route.prefix[full] & mask);
}
Result forward(Bytes f, std::uint8_t ingress, const Config& cfg) noexcept {
    Parsed p;
    const auto reason = parse(f, p);
    if (reason != Reason::forwarded) return {reason, 0};
    const Route* best = nullptr;
    for (std::size_t i = 0; i < std::min(cfg.route_count, cfg.routes.size()); ++i) {
        const auto& r = cfg.routes[i];
        if (r.family == p.family && matches(p.destination, r) &&
            (best == nullptr || r.prefix_length > best->prefix_length)) best = &r;
    }
    if (best == nullptr) return {Reason::no_route, 0};
    if (ingress >= 2 || best->egress >= 2 || best->egress == ingress) return {Reason::wrong_ingress, 0};
    if (p.ip_size > cfg.mtu) return {Reason::mtu, 0};
    if (best->neighbour >= cfg.neighbours.size() || !cfg.neighbours[best->neighbour].resolved)
        return {Reason::no_neighbour, 0};
    std::copy(cfg.neighbours[best->neighbour].mac.begin(), cfg.neighbours[best->neighbour].mac.end(), f.begin());
    std::copy(cfg.local_macs[best->egress].begin(), cfg.local_macs[best->egress].end(), f.begin() + 6);
    if (p.family == 4) {
        --f[p.l3 + 8]; f[p.l3 + 10] = 0; f[p.l3 + 11] = 0;
        const auto c = checksum(ConstBytes(f).subspan(p.l3, 20));
        f[p.l3 + 10] = static_cast<std::uint8_t>(c >> 8U);
        f[p.l3 + 11] = static_cast<std::uint8_t>(c & 0xffU);
    } else --f[p.l3 + 7];
    return {Reason::forwarded, best->egress};
}
Config lab_config() {
    Config c;
    c.local_macs = {Mac{2,0,0,0,0,1}, Mac{2,0,0,0,0,2}};
    c.neighbours[0] = {Mac{2,0,0,0,1,1}, true};
    c.neighbours[1] = {Mac{2,0,0,0,2,1}, true};
    c.routes[0] = {Address{192,0,2}, 4,24,0,0};
    c.routes[1] = {Address{198,51,100}, 4,24,1,1};
    c.routes[2] = {Address{0x20,1,0x0d,0xb8,0,1}, 6,64,0,0};
    c.routes[3] = {Address{0x20,1,0x0d,0xb8,0,2}, 6,64,1,1};
    c.route_count = 4;
    return c;
}
}
