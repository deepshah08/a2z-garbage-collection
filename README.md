# Garbage Collection & Managed Runtimes, Heap by Heap

> An interactive, visual field guide to garbage collection algorithms and runtime memory management: from reference counting cycle leaks, Tri-Color marking invariants, and sliding compaction to HotSpot generational heaps, G1GC mixed evacuation sets, ZGC colored pointers with multi-mapping virtual memory, and JVM safepoint stall diagnostics.

---

## 🏛️ Curricular Foundations

This curriculum synthesizes reference algorithms and operational runtime internals from:
- **Richard Jones, Antony Hosking, Eliot Moss**, *The Garbage Collection Handbook: The Art of Automatic Memory Management* (CRC Press)
- **Charlie Hunt & Binu John**, *Java Performance* (Addison-Wesley)
- **Per Liden & Stefan Karlsson**, *ZGC: A Low-Latency Garbage Collector* (OpenJDK Engineering)
- **Edsger W. Dijkstra et al.**, *On-the-fly garbage collection: An exercise in cooperation* (CACM 1978)
- **Detlefs, Flood, Heller, Printezis**, *Garbage-First Garbage Collection* (ISMM 2004)

---

## 🔬 Interactive Simulators Included

| Chapter | Simulator | Key Concepts Demonstrated |
|---|---|---|
| **Figure 00** | `gcHero` | The GC Tradeoff Triangle: Throughput vs STW Pause Latency vs Footprint |
| **Chapter 01** | `refCountingCycles` | Reference Counting Island of Isolation Cycles & Tracing GC Root Reachability |
| **Chapter 02** | `triColorMarking` | Tri-Color Marking Invariants: White, Grey, Black & SATB Write Barriers |
| **Chapter 03** | `barrierDynamics` | JIT Compiler Barriers: Card Marking vs SATB vs ZGC Load Barriers |
| **Chapter 04** | `markSweepCompact` | External Memory Fragmentation vs Sliding Mark-Compact Bump Pointer Allocation |
| **Chapter 05** | `generationalHeap` | Weak Generational Hypothesis, Eden, S0/S1 Survivors & Old Gen Tenuring |
| **Chapter 06** | `cardTableRset` | Cross-Generational References, 512-Byte Card Tables & Isolated Minor GC Scans |
| **Chapter 07** | `tlabAllocation` | Thread-Local Allocation Buffers (TLAB), Lock-Free Bump Pointer & Refills |
| **Chapter 08** | `cmsFailure` | Concurrent Mark Sweep (CMS), Floating Garbage & Concurrent Mode Failure STWs |
| **Chapter 09** | `g1Regions` | G1GC 2048-Region Grid, Dynamic Roles (Eden, Survivor, Old, Humongous, Free) |
| **Chapter 10** | `g1Evacuation` | Collection Set (CSet) Selection, Soft MaxGCPauseMillis Budgets, Mixed Evacuation |
| **Chapter 11** | `zgcColoredPointers` | ZGC 64-Bit References, 44-Bit Address Space, 4 Color Bits & OS Multi-Mapping |
| **Chapter 12** | `zgcLoadBarrier` | ZGC Self-Healing Load Barriers, Forwarding Table Lookups, In-Place Relocation |
| **Chapter 13** | `referenceTypes` | Strong, Soft, Weak & Phantom References with ReferenceQueues & Cleaners |
| **Chapter 14** | `safepointPauses` | JVM Safepoint Mechanics, Time-To-Safepoint (TTSP) Stalls & Counted Loop Flags |

---

## 🧪 Automated Testing & Verification

The suite includes a comprehensive headless test runner that mounts every simulator, exercises all interactive controls across 4 standard viewports (320px, 480px, 768px, 1200px):

```bash
npm test
```

---

## 🚀 Deployment

Zero-build vanilla web architecture. Built with HTML5, CSS3, and ES6+ Canvas APIs.
Hosted on GitHub Pages.
