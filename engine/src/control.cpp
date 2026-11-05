#include "liquidnat/control.hpp"
#include <algorithm>
#include <stdexcept>

namespace liquidnat::control {
static std::uint64_t get(ConstBytes b, std::size_t at, std::size_t n) noexcept {
    std::uint64_t v = 0;
    for (std::size_t i = 0; i < n; ++i) v = (v << 8U) | b[at + i];
    return v;
}
static void put(Bytes b, std::size_t at, std::size_t n, std::uint64_t v) noexcept {
    for (std::size_t i = n; i > 0; --i) { b[at + i - 1] = static_cast<std::uint8_t>(v & 255U); v >>= 8U; }
}
Code decode(ConstBytes b, Header& h) noexcept {
    h = {};
    if (b.size() < header_size || b.size() > header_size + max_payload) return Code::malformed;
    if (get(b, 0, 4) != 0x4c4e4354 || get(b, 12, 4) != 0) return Code::malformed;
    if (get(b, 4, 2) != 1) return Code::version;
    const auto op = get(b, 6, 2);
    if (op < 1 || op > 4) return Code::unsupported;
    if (get(b, 8, 4) != b.size() - header_size) return Code::malformed;
    h.operation = static_cast<Operation>(op);
    h.request = get(b, 16, 8); h.epoch = get(b, 24, 8);
    h.generation = get(b, 32, 8); h.revision = get(b, 40, 8); h.deadline = get(b, 48, 8);
    h.payload = b.subspan(header_size);
    if (h.request == 0 || h.deadline == 0) return Code::malformed;
    return Code::ok;
}
std::vector<std::uint8_t> encode(const Header& h) {
    if (h.payload.size() > max_payload) throw std::length_error("control payload exceeds 65536");
    std::vector<std::uint8_t> b(header_size + h.payload.size());
    put(b, 0, 4, 0x4c4e4354); put(b, 4, 2, 1); put(b, 6, 2, static_cast<std::uint16_t>(h.operation));
    put(b, 8, 4, h.payload.size()); put(b, 16, 8, h.request); put(b, 24, 8, h.epoch);
    put(b, 32, 8, h.generation); put(b, 40, 8, h.revision); put(b, 48, 8, h.deadline);
    std::copy(h.payload.begin(), h.payload.end(), b.begin() + static_cast<std::ptrdiff_t>(header_size));
    return b;
}
Reply RevisionModel::execute(ConstBytes b, std::uint64_t now) {
    Header h;
    const auto parsed = decode(b, h);
    auto reject = [this](Code c) { return Reply{Status::rejected, c, active_}; };
    if (parsed != Code::ok) return reject(parsed);
    if (h.epoch != epoch_) return reject(Code::epoch);
    for (std::size_t i = 0; i < used_; ++i) {
        const auto& r = records_[i];
        if (r.id == h.request) {
            if (r.request.size() == b.size() && std::equal(b.begin(), b.end(), r.request.begin())) return r.reply;
            return reject(Code::conflict);
        }
    }
    if (h.deadline <= now) return reject(Code::expired);
    if (used_ == records_.size()) return reject(Code::replay_full);
    // Allocate the replay record before mutating revision state. Allocation failure
    // must never leave an applied operation without a recorded response.
    std::vector<std::uint8_t> saved(b.begin(), b.end());
    Reply reply{Status::accepted, Code::ok, active_};
    if (!h.payload.empty()) reply = reject(Code::unsupported); // Snapshot payload codec is not implemented.
    else if (h.operation == Operation::stage) {
        if (h.revision <= active_ || h.revision == 0) reply = reject(Code::revision);
        else if (h.generation <= generation_) reply = reject(Code::generation);
        else { staged_ = h.revision; staged_generation_ = h.generation; }
    } else if (h.operation == Operation::activate) {
        if (h.revision != staged_ || staged_ == 0) reply = reject(Code::revision);
        else if (h.generation != staged_generation_ || h.generation <= generation_) reply = reject(Code::generation);
        else { active_ = staged_; generation_ = staged_generation_; staged_ = 0; reply = {Status::applied, Code::ok, active_}; }
    }
    records_[used_++] = {std::move(saved), reply, h.request};
    return reply;
}
}
