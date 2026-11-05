#include "liquidnat/packet.hpp"
#include <rte_eal.h>
#include <rte_ethdev.h>
#include <rte_mbuf.h>
#include <rte_version.h>
#include <array>
#include <charconv>
#include <chrono>
#include <csignal>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <sys/resource.h>

namespace {
volatile std::sig_atomic_t stopping = 0;
void stop(int) { stopping = 1; }
constexpr std::uint16_t burst = 32;
void require(int rc, const char* operation) {
    if (rc < 0) throw std::runtime_error(std::string(operation) + " failed: " + std::to_string(rc));
}
bool file_port(std::string_view value) {
    const auto comma = value.find(',');
    if (comma == std::string_view::npos) return false;
    const auto name = value.substr(0, comma);
    if (name != "net_pcap0" && name != "net_pcap1") return false;
    value.remove_prefix(comma + 1);
    bool rx = false, tx = false;
    while (!value.empty()) {
        const auto next = value.find(',');
        const auto option = value.substr(0, next);
        if (option.starts_with("rx_pcap=") && option.size() > 8 && !rx) rx = true;
        else if (option.starts_with("tx_pcap=") && option.size() > 8 && !tx) tx = true;
        else return false;
        if (next == std::string_view::npos) break;
        value.remove_prefix(next + 1);
        if (value.empty()) return false;
    }
    return rx && tx;
}
bool safe_eal(int argc, char** argv) {
    bool no_pci = false, no_huge = false, separator = false;
    unsigned devices = 0;
    for (int i = 1; i < argc; ++i) {
        const std::string_view a(argv[i]);
        if (a == "--") { separator = true; break; }
        if (a == "--no-pci") no_pci = true;
        else if (a == "--no-huge") no_huge = true;
        else if (a == "--no-shconf" || a == "--no-telemetry") continue;
        else if ((a == "-l" || a == "--file-prefix") && i + 1 < argc) ++i;
        else if (a == "--vdev" && i + 1 < argc && file_port(argv[i + 1])) { ++i; ++devices; }
        else return false;
    }
    return separator && no_pci && no_huge && devices == 2;
}
}
int main(int argc, char** argv) {
    using namespace liquidnat;
    // This initial binary is deliberately a PCAP-only lab appliance. No host NIC discovery.
    if (!safe_eal(argc, argv)) {
        std::cerr << "Lab requires --no-pci --no-huge and exactly two file-backed net_pcap ports before --; unsupported EAL arguments rejected\n";
        return 2;
    }
    bool initialized = false;
    std::array<std::uint16_t, 2> ports{};
    std::size_t configured = 0;
    rte_mempool* pool = nullptr;
    auto cleanup = [&] {
        for (std::size_t i = 0; i < configured; ++i) {
            (void)rte_eth_dev_stop(ports[i]); (void)rte_eth_dev_close(ports[i]);
        }
        if (pool) rte_mempool_free(pool);
        if (initialized) (void)rte_eal_cleanup();
    };
    try {
        const auto consumed = rte_eal_init(argc, argv);
        require(consumed, "EAL init"); initialized = true;
        argc -= consumed; argv += consumed;
        std::string output;
        std::uint64_t duration_ms = 500;
        bool lab = false;
        for (int i = 1; i < argc; ++i) {
            const std::string_view a(argv[i]);
            if (a == "--lab") lab = true;
            else if (a == "--report" && i + 1 < argc) output = argv[++i];
            else if (a == "--duration-ms" && i + 1 < argc) {
                const std::string_view v(argv[++i]);
                const auto [end, ec] = std::from_chars(v.data(), v.data() + v.size(), duration_ms);
                if (ec != std::errc{} || end != v.data() + v.size() || duration_ms < 1 || duration_ms > 60000)
                    throw std::runtime_error("Duration must be 1..60000 ms");
            } else throw std::runtime_error("Unknown or incomplete application option");
        }
        if (!lab || output.empty()) throw std::runtime_error("Require --lab --report PATH");
        if (rte_eth_dev_count_avail() != 2) throw std::runtime_error("Exactly two PCAP ports required");
        pool = rte_pktmbuf_pool_create("liquidnat_pool", 8191, 128, 0, 4096, static_cast<int>(rte_socket_id()));
        if (!pool) throw std::runtime_error("mbuf pool allocation failed");
        std::size_t n = 0;
        for (std::uint16_t port = rte_eth_find_next(0); port < RTE_MAX_ETHPORTS;
             port = rte_eth_find_next(static_cast<std::uint16_t>(port + 1))) {
            rte_eth_dev_info info{};
            require(rte_eth_dev_info_get(port, &info), "device info");
            if (!info.driver_name || std::string_view(info.driver_name) != "net_pcap")
                throw std::runtime_error("Only net_pcap ports permitted");
            ports[n++] = port;
            rte_eth_conf conf{};
            require(rte_eth_dev_configure(port, 1, 1, &conf), "configure"); ++configured;
            require(rte_eth_rx_queue_setup(port, 0, 128, rte_socket_id(), nullptr, pool), "RX setup");
            require(rte_eth_tx_queue_setup(port, 0, 128, rte_socket_id(), nullptr), "TX setup");
            require(rte_eth_dev_start(port), "start");
        }
        const auto config = lab_config();
        Counters counters;
        std::array<rte_mbuf*, burst> packets{};
        std::signal(SIGINT, stop); std::signal(SIGTERM, stop);
        const auto start = std::chrono::steady_clock::now();
        const auto until = start + std::chrono::milliseconds(duration_ms);
        while (!stopping && std::chrono::steady_clock::now() < until) {
            for (std::uint8_t in = 0; in < 2; ++in) {
                const auto received = rte_eth_rx_burst(ports[in], 0, packets.data(), burst);
                std::array<rte_mbuf*, burst> tx{};
                std::uint16_t count = 0;
                for (std::uint16_t i = 0; i < received; ++i) {
                    auto* m = packets[i];
                    add(counters.rx); add(counters.rx_bytes, rte_pktmbuf_pkt_len(m));
                    if (m->nb_segs != 1) { add(counters.multisegment); rte_pktmbuf_free(m); continue; }
                    Bytes frame(rte_pktmbuf_mtod(m, std::uint8_t*), rte_pktmbuf_data_len(m));
                    const auto result = forward(frame, in, config);
                    add(counters.outcomes[static_cast<std::size_t>(result.reason)]);
                    if (result.reason == Reason::forwarded) tx[count++] = m;
                    else rte_pktmbuf_free(m);
                }
                const auto sent = rte_eth_tx_burst(ports[1 - in], 0, tx.data(), count);
                add(counters.tx, sent);
                for (std::uint16_t i = sent; i < count; ++i) { rte_pktmbuf_free(tx[i]); add(counters.tx_dropped); }
            }
        }
        const auto seconds = std::chrono::duration<double>(std::chrono::steady_clock::now() - start).count();
        // Closing PMDs flushes capture output before the independent oracle reads it.
        cleanup(); initialized = false; configured = 0; pool = nullptr;
        rusage usage{}; if (getrusage(RUSAGE_SELF, &usage) != 0) throw std::runtime_error("getrusage failed");
        std::ofstream report(output);
        if (!report) throw std::runtime_error("Cannot open report output");
        report << "{\"schema_version\":1,\"mode\":\"dpdk-pcap-lab\",\"dpdk\":\"" << rte_version()
               << "\",\"elapsed_seconds\":" << seconds << ",\"rx\":" << counters.rx
               << ",\"rx_bytes\":" << counters.rx_bytes << ",\"tx\":" << counters.tx
               << ",\"tx_dropped\":" << counters.tx_dropped << ",\"multisegment\":" << counters.multisegment
               << ",\"max_rss_kib\":" << usage.ru_maxrss << ",\"user_cpu_seconds\":"
               << (static_cast<double>(usage.ru_utime.tv_sec) + static_cast<double>(usage.ru_utime.tv_usec) / 1e6)
               << ",\"system_cpu_seconds\":"
               << (static_cast<double>(usage.ru_stime.tv_sec) + static_cast<double>(usage.ru_stime.tv_usec) / 1e6)
               << ",\"limits\":{\"burst\":32,\"mbufs\":8191,\"data_room\":4096,\"routes\":16,\"neighbours\":16,\"mtu\":1500},\"outcomes\":{";
        for (std::size_t i = 0; i < reason_names.size(); ++i)
            report << (i ? "," : "") << '"' << reason_names[i] << "\":" << counters.outcomes[i];
        report << "}}\n";
        report.close(); if (!report) throw std::runtime_error("Report write failed");
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "packetd: " << e.what() << '\n'; cleanup(); return 1;
    }
}
