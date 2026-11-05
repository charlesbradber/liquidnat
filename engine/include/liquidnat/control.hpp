#pragma once
#include "liquidnat/packet.hpp"
#include <vector>

namespace liquidnat::control {
constexpr std::size_t header_size = 56;
constexpr std::size_t max_payload = 65536;
enum class Operation : std::uint16_t { health = 1, counters = 2, stage = 3, activate = 4 };
enum class Status { accepted, applied, rejected };
enum class Code { ok, malformed, version, unsupported, expired, epoch, conflict, replay_full, revision, generation };
struct Header {
    Operation operation{};
    std::uint64_t request{}, epoch{}, generation{}, revision{}, deadline{};
    ConstBytes payload{};
};
Code decode(ConstBytes bytes, Header& out) noexcept;
std::vector<std::uint8_t> encode(const Header& header);
struct Reply { Status status; Code code; std::uint64_t active_revision; };
// Control-plane model only. Not a socket server or packet-worker acknowledgement.
class RevisionModel {
public:
    explicit RevisionModel(std::uint64_t epoch) : epoch_(epoch) {}
    Reply execute(ConstBytes bytes, std::uint64_t now);
private:
    struct Record { std::vector<std::uint8_t> request; Reply reply{}; std::uint64_t id{}; };
    std::array<Record, 64> records_{};
    std::size_t used_{};
    std::uint64_t epoch_{}, active_{}, staged_{}, generation_{}, staged_generation_{};
};
}
