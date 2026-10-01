/* ==========================================================================
   Garbage Collection, Heap by Heap — G1GC, ZGC & Modern Runtimes
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 09. G1GC Region Architecture: Eden, Survivor, Old & Humongous Regions
   * -------------------------------------------------------------------------- */
  OS.register('g1Regions', function (host) {
    const regions = [
      { id: 0, type: 'E', garbageRatio: 85 },
      { id: 1, type: 'E', garbageRatio: 90 },
      { id: 2, type: 'S', garbageRatio: 20 },
      { id: 3, type: 'O', garbageRatio: 75 },
      { id: 4, type: 'O', garbageRatio: 30 },
      { id: 5, type: 'H', garbageRatio: 10 },
      { id: 6, type: 'F', garbageRatio: 0 },
      { id: 7, type: 'F', garbageRatio: 0 }
    ];
    let logMsg = 'G1GC Heap: 2048 non-contiguous uniform regions (1MB to 32MB). Region roles are assigned dynamically.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Allocate Large Array (>50% Region)', () => {
      const free = regions.find(r => r.type === 'F');
      if (free) {
        free.type = 'H';
        free.garbageRatio = 0;
        logMsg = `HUMONGOUS ALLOCATION: Array exceeds 50% region size! Allocated in Humongous Region #${free.id}.`;
      } else {
        logMsg = 'NO FREE REGIONS: Heap expansion or full evacuation required.';
      }
      render();
    }, { primary: true });

    OS.button(controls, 'Trigger Mixed Evacuation Pause', () => {
      // Evacuate high-garbage regions (E0, E1, O3)
      regions.forEach(r => {
        if (r.type === 'E' || (r.type === 'O' && r.garbageRatio > 70)) {
          r.type = 'F';
          r.garbageRatio = 0;
        }
      });
      logMsg = 'MIXED GC EVACUATION: Evacuated Eden & highest-garbage Old regions into fresh Survivor/Old regions. Freed blocks returned to Free list!';
      render();
    });

    OS.button(controls, 'Reset Regions', () => {
      regions[0] = { id: 0, type: 'E', garbageRatio: 85 };
      regions[1] = { id: 1, type: 'E', garbageRatio: 90 };
      regions[2] = { id: 2, type: 'S', garbageRatio: 20 };
      regions[3] = { id: 3, type: 'O', garbageRatio: 75 };
      regions[4] = { id: 4, type: 'O', garbageRatio: 30 };
      regions[5] = { id: 5, type: 'H', garbageRatio: 10 };
      regions[6] = { id: 6, type: 'F', garbageRatio: 0 };
      regions[7] = { id: 7, type: 'F', garbageRatio: 0 };
      logMsg = 'G1GC regions reset.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('G1GC Region Matrix: Dynamic Region Roles (Eden, Survivor, Old, Humongous, Free)', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = logMsg.includes('HUMONGOUS') ? OS.C.amber : OS.C.green;
        ctx.fillText(logMsg, 16, 46);

        // Draw 8 region cards
        const regW = Math.min(52, (w - 60) / regions.length);
        const regH = 75;
        const startY = 80;

        regions.forEach((r, idx) => {
          const rx = 16 + idx * (regW + 8);

          let fill = OS.rgba(OS.C.muted, 0.08);
          let border = OS.C.border;
          let label = 'Free';
          if (r.type === 'E') { fill = OS.rgba(OS.C.accent, 0.2); border = OS.C.accent; label = 'Eden'; }
          else if (r.type === 'S') { fill = OS.rgba(OS.C.teal, 0.2); border = OS.C.teal; label = 'Surv'; }
          else if (r.type === 'O') { fill = OS.rgba(OS.C.amber, 0.2); border = OS.C.amber; label = 'Old'; }
          else if (r.type === 'H') { fill = OS.rgba(OS.C.red, 0.2); border = OS.C.red; label = 'Hum'; }

          ctx.fillStyle = fill;
          ctx.strokeStyle = border;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(rx, startY, regW, regH, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(10, 'mono', 700);
          ctx.fillText(`R#${r.id}`, rx + 6, startY + 20);

          ctx.font = OS.font(11, 'mono', 800);
          ctx.fillStyle = border;
          ctx.fillText(r.type, rx + 6, startY + 42);

          ctx.font = OS.font(8, 'sans', 400);
          ctx.fillStyle = OS.C.muted;
          ctx.fillText(label, rx + 6, startY + 62);
        });

        // Legend footer
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Legend: [E] Eden | [S] Survivor | [O] Old Gen | [H] Humongous (Contiguous) | [F] Free', 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 10. G1GC Mixed Evacuation & Garbage-First Priority
   * -------------------------------------------------------------------------- */
  OS.register('g1Evacuation', function (host) {
    let targetPauseMs = 200;
    let selectedCSet = ['Eden-0', 'Eden-1', 'Old-3 (85% Garbage)'];
    let statusText = 'Garbage-First: Prioritizes regions with highest garbage ratio to maximize reclaimed bytes within pause budget.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.slider(controls, {
      label: 'Max GC Pause Time Goal (-XX:MaxGCPauseMillis)',
      min: 50,
      max: 400,
      step: 25,
      value: targetPauseMs,
      onChange: (v) => {
        targetPauseMs = parseFloat(v);
        if (targetPauseMs < 100) {
          selectedCSet = ['Eden-0']; // very few regions fit budget
          statusText = `TIGHT PAUSE BUDGET (${targetPauseMs}ms): Evacuation set trimmed to fit time goal! Risk of falling behind allocation rate.`;
        } else if (targetPauseMs < 250) {
          selectedCSet = ['Eden-0', 'Eden-1', 'Old-3 (85% Garbage)'];
          statusText = `BALANCED BUDGET (${targetPauseMs}ms): Reclaims all Young plus highest-yielding Old regions.`;
        } else {
          selectedCSet = ['Eden-0', 'Eden-1', 'Old-3 (85% Garbage)', 'Old-7 (65% Garbage)'];
          statusText = `GENEROUS BUDGET (${targetPauseMs}ms): Reclaims multiple Old Gen regions in single mixed pause.`;
        }
        render();
      }
    });

    OS.button(controls, 'Execute Evacuation Pause', () => {
      statusText = `EVACUATION COMPLETE: Live objects from [${selectedCSet.join(', ')}] copied to Survivor/Old. Pause took ~${Math.round(targetPauseMs * 0.75)}ms.`;
      render();
    }, { primary: true });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`G1GC Collection Set (CSet) Selection & Pause Target Modeling`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = targetPauseMs < 100 ? OS.C.amber : OS.C.green;
        ctx.fillText(statusText, 16, 46);

        // CSet card
        const cardX = 16;
        const cardY = 75;
        const cardW = Math.min(480, w - 32);
        const cardH = 100;

        ctx.fillStyle = OS.rgba(OS.C.accent, 0.1);
        ctx.strokeStyle = OS.C.accent;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText(`Active Collection Set (CSet) | Target: ${targetPauseMs}ms`, cardX + 14, cardY + 24);

        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillText('Regions Selected for Evacuation:', cardX + 14, cardY + 48);

        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillStyle = OS.C.accent;
        selectedCSet.forEach((item, idx) => {
          ctx.fillText(`• ${item}`, cardX + 14, cardY + 70 + idx * 16);
        });

        // Footer
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('G1 uses historical decay rate metrics to predict evacuation time per region before adding to CSet.', 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 11. ZGC Colored Pointers & Multi-Mapping Address Space
   * -------------------------------------------------------------------------- */
  OS.register('zgcColoredPointers', function (host) {
    let activeColor = 'Marked0'; // 'Marked0', 'Marked1', 'Remapped'
    let statusText = 'ZGC Colored Pointers: Stores reference metadata in top bits of the 64-bit pointer, not in the object header!';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.select(controls, 'Active Pointer Color', [
      { value: 'Marked0', label: 'Marked0 (Active during Phase 0 Concurrent Mark)' },
      { value: 'Marked1', label: 'Marked1 (Active during Phase 1 Concurrent Mark)' },
      { value: 'Remapped', label: 'Remapped (Points to relocated final destination)' }
    ], (val) => {
      activeColor = val;
      statusText = `Color transitioned to ${val}. Linux virtual memory maps all 3 colors to same physical RAM via mmap() aliases!`;
      render();
    });

    OS.button(controls, 'Trigger Concurrent Marking Phase', () => {
      activeColor = activeColor === 'Marked0' ? 'Marked1' : 'Marked0';
      statusText = `Swapped active marking bit to ${activeColor}. Pointers with older color bit will trigger load barrier.`;
      render();
    }, { primary: true });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`ZGC 64-bit Reference Layout: 44-bit Address & 4 Metadata Color Bits`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = OS.C.green;
        ctx.fillText(statusText, 16, 46);

        // Draw 64-bit pointer breakdown
        const barX = 16;
        const barY = 80;
        const barW = Math.min(480, w - 32);
        const barH = 45;

        // Unused (16 bits)
        const wUnused = (16 / 64) * barW;
        ctx.fillStyle = OS.rgba(OS.C.muted, 0.15);
        ctx.fillRect(barX, barY, wUnused, barH);
        ctx.fillStyle = OS.C.muted;
        ctx.font = OS.font(9, 'mono', 500);
        ctx.fillText('16b Unused', barX + 8, barY + 26);

        // Color bits (4 bits: Finalizable, Remapped, Marked1, Marked0)
        const wColor = (4 / 64) * barW;
        ctx.fillStyle = OS.C.accent;
        ctx.fillRect(barX + wUnused, barY, wColor, barH);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('Color', barX + wUnused + 4, barY + 26);

        // Object Address (44 bits = 16 TB heap capacity)
        const wAddr = barW - (wUnused + wColor);
        ctx.fillStyle = OS.rgba(OS.C.teal, 0.2);
        ctx.fillRect(barX + wUnused + wColor, barY, wAddr, barH);
        ctx.fillStyle = OS.C.teal;
        ctx.fillText('44-bit Object Address Space (Up to 16 Terabytes RAM)', barX + wUnused + wColor + 14, barY + 26);

        // Color indicator
        const cardY = barY + barH + 25;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Active GC Color: [${activeColor}] | Multi-Mapping: 3 Virtual Aliases -> 1 Physical Page Frame`, 16, cardY);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 12. Self-Healing Load Barriers in ZGC
   * -------------------------------------------------------------------------- */
  OS.register('zgcLoadBarrier', function (host) {
    let pointerState = 'OLD_COLOR'; // 'OLD_COLOR', 'HEALED'
    let readsHandled = 1;
    let logMsg = 'Object dereference o.field: Pointer color does not match current good color! Load barrier slow path triggered.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Read Reference: o.field', () => {
      readsHandled++;
      if (pointerState === 'OLD_COLOR') {
        pointerState = 'HEALED';
        logMsg = '🛡️ SELF-HEALING LOAD BARRIER: Looked up Forwarding Table, updated local pointer to new location! All future reads are fast native instructions.';
      } else {
        logMsg = '⚡ FAST-PATH READ: Pointer already colored Remapped! Executed in single CPU test instruction without touching forwarding table.';
      }
      render();
    }, { primary: true });

    OS.button(controls, 'Simulate Relocation Phase', () => {
      pointerState = 'OLD_COLOR';
      logMsg = 'GC Relocation Phase active: Live objects moved to new pages; pointers in heap initially retain old addresses.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('ZGC Self-Healing Load Barrier: On-Demand Pointer Relocation', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = pointerState === 'HEALED' ? OS.C.green : OS.C.amber;
        ctx.fillText(logMsg, 16, 46);

        // State Cards
        const cardW = Math.min(220, (w - 48) / 2);
        const cardH = 95;
        const startY = 75;

        // Pointer Card
        ctx.fillStyle = pointerState === 'HEALED' ? OS.rgba(OS.C.green, 0.15) : OS.rgba(OS.C.amber, 0.15);
        ctx.strokeStyle = pointerState === 'HEALED' ? OS.C.green : OS.C.amber;
        ctx.beginPath();
        ctx.roundRect(16, startY, cardW, cardH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('Reference Pointer', 26, startY + 22);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillText(pointerState === 'HEALED' ? 'Points to: 0x4000 (New Address)' : 'Points to: 0x1000 (Forwarded)', 26, startY + 44);
        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillStyle = pointerState === 'HEALED' ? OS.C.green : OS.C.amber;
        ctx.fillText(`State: [${pointerState}]`, 26, startY + 68);

        // Forwarding Table Card
        const x2 = 16 + cardW + 16;
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.1);
        ctx.strokeStyle = OS.C.accent;
        ctx.beginPath();
        ctx.roundRect(x2, startY, cardW, cardH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('In-Memory Forwarding Table', x2 + 10, startY + 22);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillText('From: 0x1000 -> To: 0x4000', x2 + 10, startY + 44);
        ctx.fillStyle = OS.C.accent;
        ctx.fillText('Concurrent Relocation Active', x2 + 10, startY + 68);

        // Footer
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(`Reads Handled: ${readsHandled} | Self-healing eliminates GC thread pointer-updating STW pauses!`, 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 13. Strong, Soft, Weak & Phantom References
   * -------------------------------------------------------------------------- */
  OS.register('referenceTypes', function (host) {
    let refType = 'WEAK'; // 'STRONG', 'SOFT', 'WEAK', 'PHANTOM'
    let clearedOn = 'Cleared eagerly during next GC cycle';
    let statusText = 'WeakReference: Reclaimed by GC whenever unreachable via strong references. Common in WeakHashMap.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.select(controls, 'Reference Strength', [
      { value: 'STRONG', label: 'StrongReference (Standard Object o = new Object())' },
      { value: 'SOFT', label: 'SoftReference (Cleared only before OutOfMemoryError)' },
      { value: 'WEAK', label: 'WeakReference (Cleared at next GC cycle)' },
      { value: 'PHANTOM', label: 'PhantomReference (Enqueued after finalization for Cleaner cleanup)' }
    ], (val) => {
      refType = val;
      if (val === 'STRONG') {
        clearedOn = 'Never cleared while reachable from GC roots';
        statusText = 'StrongReference: The default reference type. Prevents GC deallocation.';
      } else if (val === 'SOFT') {
        clearedOn = 'Cleared only when heap reaches near-OOM exhaustion';
        statusText = 'SoftReference: Useful for memory-sensitive caches that expand with available RAM.';
      } else if (val === 'WEAK') {
        clearedOn = 'Cleared unconditionally on next GC mark pass';
        statusText = 'WeakReference: Prevents canonical mapping memory leaks (WeakHashMap).';
      } else {
        clearedOn = 'Object finalized; reference enqueued to ReferenceQueue for direct memory cleanup';
        statusText = 'PhantomReference: Used by java.lang.ref.Cleaner to free off-heap DirectByteBuffers safely.';
      }
      render();
    });

    OS.button(controls, 'Run GC Cycle', () => {
      if (refType === 'WEAK' || refType === 'PHANTOM') {
        statusText = `GC RECLAIMED: ${refType} reference target reclaimed! Reference enqueued.`;
      } else {
        statusText = `RETAINED: ${refType} reference retained (heap memory pressure normal).`;
      }
      render();
    }, { primary: true });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Java Reference Hierarchy & Lifecycle: Strong ➔ Soft ➔ Weak ➔ Phantom`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = OS.C.green;
        ctx.fillText(statusText, 16, 46);

        // Card display
        const cardX = 16;
        const cardY = 75;
        const cardW = Math.min(480, w - 32);
        const cardH = 95;

        ctx.fillStyle = OS.rgba(OS.C.accent, 0.1);
        ctx.strokeStyle = OS.C.accent;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText(`Reference Type: java.lang.ref.${refType === 'STRONG' ? 'Object' : refType.charAt(0) + refType.slice(1).toLowerCase() + 'Reference'}`, cardX + 14, cardY + 24);

        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillText(`Reclamation Rule: ${clearedOn}`, cardX + 14, cardY + 48);

        ctx.font = OS.font(10, 'mono', 500);
        ctx.fillStyle = OS.C.accent;
        ctx.fillText(`get() accessor returns: ${refType === 'PHANTOM' ? 'null (Always null to prevent resurrection)' : 'Referent object (or null if cleared)'}`, cardX + 14, cardY + 70);

        // Footer
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Phantom references replace finalizers (Object.finalize() deprecated in Java 9, removed in 18).', 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 14. JVM Safepoint Pauses & Time-To-Safepoint (TTSP)
   * -------------------------------------------------------------------------- */
  OS.register('safepointPauses', function (host) {
    let ttspMs = 12; // Time To Safepoint
    let pauseMs = 85; // GC pause
    let culpritThread = 'Normal JNI Poll';
    let statusText = 'Safepoints: All JVM application threads must halt at known code points before GC pause can start.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Simulate Uncounted Loop (TTSP Stall)', () => {
      ttspMs = 2800; // 2.8 seconds stall!
      culpritThread = 'Thread-3: JIT Counted Loop without Safepoint Poll';
      statusText = '🚨 TTSP STALL: Thread-3 stuck in hot int loop without safepoint poll! Entire JVM frozen waiting for 1 thread to yield!';
      render();
    }, { primary: true });

    OS.button(controls, 'Enable -XX:+UseCountedLoopSafepoints', () => {
      ttspMs = 2;
      culpritThread = 'All threads halted cleanly';
      statusText = '✓ OPTIMIZED: Safepoint poll injected into loop backedge. TTSP reduced to 2ms.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`JVM Safepoint Mechanics & Time-To-Safepoint (TTSP) Latency Diagnosis`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = ttspMs > 500 ? OS.C.red : OS.C.green;
        ctx.fillText(statusText, 16, 46);

        // Total pause composition bar
        const barX = 16;
        const barY = 75;
        const barW = Math.min(480, w - 32);
        const barH = 36;

        const totalMs = ttspMs + pauseMs;
        const ttspW = (ttspMs / totalMs) * barW;
        const gcW = barW - ttspW;

        // TTSP portion
        ctx.fillStyle = ttspMs > 500 ? OS.C.red : OS.C.amber;
        ctx.fillRect(barX, barY, ttspW, barH);

        // GC Pause portion
        ctx.fillStyle = OS.C.accent;
        ctx.fillRect(barX + ttspW, barY, gcW, barH);

        // Labels
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillText(`TTSP: ${ttspMs}ms (${Math.round((ttspMs / totalMs) * 100)}%)`, barX + 6, barY + 22);
        ctx.fillText(`GC Work: ${pauseMs}ms`, barX + ttspW + 10, barY + 22);

        // Card summary
        const cardY = barY + barH + 28;
        ctx.font = OS.font(10, 'mono', 500);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Culprit: ${culpritThread} | Total User-Perceived Freeze: ${totalMs}ms`, 16, cardY);

        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Diagnose TTSP via -Xlog:safepoint=debug: "Total time for which application threads were stopped"', 16, cardY + 20);
      }
    });
    render();
  });

})();
