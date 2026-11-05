#include "liquidnat/packet.hpp"
#include "liquidnat/control.hpp"
#include <algorithm>
#include <cstdlib>
#include <iostream>
#include <random>
#include <vector>

using namespace liquidnat;
static std::size_t checks = 0;
static void check(bool ok, const char* message) {
    ++checks;
    if (!ok) { std::cerr << "FAIL: " << message << '\n'; std::exit(1); }
}
static void fix(std::vector<std::uint8_t>& p) {
    p[24] = p[25] = 0;
    const auto c = checksum(ConstBytes(p).subspan(14, static_cast<std::size_t>(p[14] & 15U) * 4));
    p[24] = static_cast<std::uint8_t>(c >> 8U); p[25] = static_cast<std::uint8_t>(c & 255U);
}
static std::vector<std::uint8_t> v4() {
    std::vector<std::uint8_t> p(64);
    p[12] = 8; p[14] = 0x45; p[17] = 50; p[22] = 64; p[23] = 17;
    p[26] = 192; p[28] = 2; p[29] = 10;
    p[30] = 198; p[31] = 51; p[32] = 100; p[33] = 10;
    fix(p); return p;
}
int main() {
    auto config = lab_config();
    Parsed parsed;
    auto original = v4();
    for (std::size_t n = 0; n < 34; ++n)
        check(parse(ConstBytes(original).first(n), parsed) == Reason::truncated, "truncated Ethernet/IP");
    check(parse(original, parsed) == Reason::forwarded && parsed.family == 4, "IPv4 decode");
    auto p = original;
    auto r = forward(p, 0, config);
    check(r.reason == Reason::forwarded && r.egress == 1 && p[22] == 63, "IPv4 route and TTL");
    check(checksum(ConstBytes(p).subspan(14,20)) == 0, "IPv4 checksum repaired");
    check(std::equal(p.begin(),p.begin()+6, config.neighbours[1].mac.begin()), "destination MAC");
    check(std::equal(p.begin()+34,p.end(),original.begin()+34), "payload unchanged");
    check(forward(original, 1, config).reason == Reason::wrong_ingress, "same interface refused");
    p = original; p[22] = 1; fix(p);
    const auto before = p;
    check(forward(p, 0, config).reason == Reason::hop_limit && p == before, "drop does not mutate");
    p = original; p[24] ^= 1;
    check(parse(p, parsed) == Reason::checksum, "bad checksum");
    p = original; p[20] = 0x20; fix(p);
    check(parse(p,parsed) == Reason::fragment, "fragment refused");
    p = original; p[20] = 0x40; fix(p);
    check(parse(p,parsed) == Reason::forwarded, "DF supported");
    p = original; p[30] = 203; fix(p);
    check(forward(p,0,config).reason == Reason::no_route, "unknown destination");
    p = original; config.neighbours[1].resolved = false;
    check(forward(p,0,config).reason == Reason::no_neighbour, "unresolved neighbour");
    config = lab_config(); config.mtu = 40;
    check(forward(p,0,config).reason == Reason::mtu, "L3 MTU");
    config = lab_config(); config.routes[4] = {Address{198,51,100,10},4,32,1,0}; config.route_count = 5;
    p = original; check(forward(p,0,config).reason == Reason::forwarded && p[4] == 1, "longest prefix route");
    std::vector<std::uint8_t> ip6(64);
    ip6[12] = 0x86; ip6[13] = 0xdd; ip6[14] = 0x60; ip6[19] = 10; ip6[20] = 17; ip6[21] = 64;
    const Address src{0x20,1,0x0d,0xb8,0,1,0,0,0,0,0,0,0,0,0,1};
    const Address dst{0x20,1,0x0d,0xb8,0,2,0,0,0,0,0,0,0,0,0,1};
    std::copy(src.begin(),src.end(),ip6.begin()+22); std::copy(dst.begin(),dst.end(),ip6.begin()+38);
    config = lab_config();
    check(forward(ip6,0,config).reason == Reason::forwarded && ip6[21] == 63, "IPv6 hop/route");
    ip6[20] = 44; check(parse(ip6,parsed) == Reason::extension, "IPv6 fragments refused");
    std::uint64_t saturated = UINT64_MAX - 1; add(saturated,3);
    check(saturated == UINT64_MAX, "counter saturates");
    std::mt19937 random(42);
    for (std::size_t i = 0; i < 100000; ++i) {
        std::vector<std::uint8_t> bytes(random() % 2048);
        for (auto& b : bytes) b = static_cast<std::uint8_t>(random());
        (void)parse(bytes,parsed); (void)forward(bytes,static_cast<std::uint8_t>(i % 3),config);
    }
    using namespace liquidnat::control;
    RevisionModel model(7);
    Header h{Operation::stage,1,7,1,10,1000,{}};
    auto wire = encode(h);
    Header decoded;
    check(decode(wire,decoded) == Code::ok && decoded.revision == 10 && decoded.epoch == 7, "control roundtrip");
    for (std::size_t n = 0; n < header_size; ++n)
        check(decode(ConstBytes(wire).first(n),decoded) == Code::malformed, "control truncation");
    check(model.execute(wire,100).status == Status::accepted,"stage accepted");
    check(model.execute(wire,1001).status == Status::accepted,"exact replay after deadline");
    h.revision = 11;
    check(model.execute(encode(h),100).code == Code::conflict,"conflicting request ID");
    h = {Operation::activate,2,7,1,10,1000,{}};
    check(model.execute(encode(h),100).status == Status::applied,"activate staged revision");
    h.request = 3; h.revision = 11;
    check(model.execute(encode(h),100).code == Code::revision,"activation requires stage");
    h = {Operation::stage,4,7,1,11,1000,{}};
    check(model.execute(encode(h),100).code == Code::generation,"generation monotonicity");
    h.request = 5; h.epoch = 6;
    check(model.execute(encode(h),100).code == Code::epoch,"stale epoch");
    h.request = 6; h.epoch = 7; h.deadline = 100;
    check(model.execute(encode(h),100).code == Code::expired,"deadline boundary");
    wire[5] = 2; check(decode(wire,decoded) == Code::version,"unknown version");
    wire = encode(h); wire.push_back(0); check(decode(wire,decoded) == Code::malformed,"trailing bytes");
    wire.resize(header_size + max_payload + 1);
    check(decode(wire,decoded) == Code::malformed,"oversized message");
    RevisionModel full(7);
    h = {Operation::health,1,7,0,0,1000,{}};
    const auto first = encode(h);
    for (std::uint64_t i = 1; i <= 64; ++i) {
        h.request = i; check(full.execute(encode(h),100).code == Code::ok,"bounded cache fill");
    }
    h.request = 65;
    check(full.execute(encode(h),100).code == Code::replay_full,"cache exhaustion fails closed");
    check(full.execute(first,100).code == Code::ok,"old replay retained");
    std::cout << checks << " checks passed; 100000 deterministic malformed frames exercised\n";
}
