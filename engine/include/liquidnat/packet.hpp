#pragma once
#include <array>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <span>
#include <string_view>

namespace liquidnat {
using Bytes = std::span<std::uint8_t>;
using ConstBytes = std::span<const std::uint8_t>;
using Address = std::array<std::uint8_t, 16>;
using Mac = std::array<std::uint8_t, 6>;
enum class Reason : std::size_t {
    forwarded, truncated, vlan_depth, ether_type, ip_version, ip_length,
    checksum, ip_options, fragment, extension, hop_limit, no_route,
    no_neighbour, mtu, invalid_source, wrong_ingress, count
};
constexpr std::array<std::string_view, static_cast<std::size_t>(Reason::count)> reason_names{
    "forwarded", "truncated", "vlan_depth", "ether_type", "ip_version", "ip_length",
    "checksum", "ip_options", "fragment", "extension", "hop_limit", "no_route",
    "no_neighbour", "mtu", "invalid_source", "wrong_ingress"};
struct Parsed {
    std::size_t l3{}, ip_size{};
    std::uint8_t family{}, ttl{}, protocol{};
    Address source{}, destination{};
};
std::uint16_t read16(ConstBytes b, std::size_t at) noexcept;
std::uint16_t checksum(ConstBytes b) noexcept;
Reason parse(ConstBytes frame, Parsed& p) noexcept;
struct Route {
    Address prefix{};
    std::uint8_t family{}, prefix_length{}, egress{}, neighbour{};
};
struct Neighbour { Mac mac{}; bool resolved{}; };
struct Config {
    std::array<Route, 16> routes{};
    std::array<Neighbour, 16> neighbours{};
    std::array<Mac, 2> local_macs{};
    std::size_t route_count{};
    std::uint16_t mtu{1500};
};
struct Counters {
    std::array<std::uint64_t, static_cast<std::size_t>(Reason::count)> outcomes{};
    std::uint64_t rx{}, tx{}, tx_dropped{}, rx_bytes{}, tx_bytes{}, multisegment{};
};
inline void add(std::uint64_t& n, std::uint64_t amount = 1) noexcept {
    const auto max = std::numeric_limits<std::uint64_t>::max();
    n = amount > max - n ? max : n + amount;
}
struct Result { Reason reason; std::uint8_t egress; };
Result forward(Bytes frame, std::uint8_t ingress, const Config& cfg) noexcept;
Config lab_config();
}
