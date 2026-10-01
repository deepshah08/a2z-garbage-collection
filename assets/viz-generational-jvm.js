/* ==========================================================================
   Garbage Collection, Heap by Heap — Generational GCs & JVM Memory
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 05. The Weak Generational Hypothesis: Eden, Survivor & Tenuring
   * -------------------------------------------------------------------------- */
  OS.register('generationalHeap', function (host) {
    let edenUsedMb = 450;
    let edenMaxMb = 500;
    let s0UsedMb = 20;
    let s1UsedMb = 0;
    let oldUsedMb = 310;
    let tenuringAge = 2;
    let minorGcCount = 5;
    let statusText = 'The Weak Generational Hypothesis: >95% of Java objects die young within milliseconds of allocation.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Allocate 100MB in Eden', () => {
      edenUsedMb += 100;
      if (edenUsedMb >= edenMaxMb) {
        statusText = 'EDEN EXHAUSTED: Minor GC triggered! Surviving objects copied to Survivor space, infant mortality reclaimed remainder.';
        edenUsedMb = 0;
        minorGcCount++;
        // Swap survivor spaces
        s1UsedMb = Math.round(s0UsedMb * 0.8 + 15);
        s0UsedMb = 0;
        oldUsedMb += 10; // promoted long-lived objects
      } else {
        statusText = `Allocated in Eden: ${edenUsedMb}MB / ${edenMaxMb}MB used.`;
      }
      render();
    }, { primary: true });

    OS.button(controls, 'Promote to Old Generation', () => {
      oldUsedMb += s1UsedMb;
      s1UsedMb = 0;
      statusText = `TENURING THRESHOLD MET: Objects aged > ${tenuringAge} generations promoted into Tenured Old Generation!`;
      render();
    });

    OS.button(controls, 'Reset Heap Spaces', () => {
      edenUsedMb = 250;
      s0UsedMb = 20;
      s1UsedMb = 0;
      oldUsedMb = 310;
      statusText = 'Heap spaces reset.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('HotSpot Generational Heap: Young Gen (Eden, S0, S1) & Old Gen Promotion', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = edenUsedMb >= edenMaxMb ? OS.C.amber : OS.C.green;
        ctx.fillText(statusText, 16, 46);

        // Draw Young Gen (Eden, S0, S1) and Old Gen
        const startY = 75;
        const totalW = Math.min(500, w - 32);

        // Eden (40% width)
        const edenW = totalW * 0.45;
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.15);
        ctx.strokeStyle = OS.C.accent;
        ctx.beginPath();
        ctx.roundRect(16, startY, edenW, 70, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('Eden Space', 26, startY + 22);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillText(`Used: ${edenUsedMb}MB / ${edenMaxMb}MB`, 26, startY + 44);
        ctx.fillStyle = OS.C.accent;
        ctx.fillText('Bump-the-Pointer TLABs', 26, startY + 60);

        // Survivor S0/S1 (20% width)
        const sW = totalW * 0.22;
        const sX = 16 + edenW + 10;
        ctx.fillStyle = OS.rgba(OS.C.teal, 0.12);
        ctx.strokeStyle = OS.C.teal;
        ctx.beginPath();
        ctx.roundRect(sX, startY, sW, 70, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('Survivors (S0/S1)', sX + 10, startY + 22);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillText(`From: ${s0UsedMb}M | To: ${s1UsedMb}M`, sX + 10, startY + 44);
        ctx.fillStyle = OS.C.teal;
        ctx.fillText(`Age <= ${tenuringAge}`, sX + 10, startY + 60);

        // Old Gen (35% width)
        const oldW = totalW * 0.30;
        const oldX = sX + sW + 10;
        ctx.fillStyle = OS.rgba(OS.C.amber, 0.15);
        ctx.strokeStyle = OS.C.amber;
        ctx.beginPath();
        ctx.roundRect(oldX, startY, oldW, 70, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('Tenured (Old Gen)', oldX + 10, startY + 22);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillText(`Used: ${oldUsedMb}MB`, oldX + 10, startY + 44);
        ctx.fillStyle = OS.C.amber;
        ctx.fillText('Long-lived singletons', oldX + 10, startY + 60);

        // Summary footer
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(`Minor GCs Executed: ${minorGcCount} | Minor GC avoids scanning Old Gen via Card Table barrier.`, 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 06. Card Tables & Remembered Sets (RSet): Cross-Generational References
   * -------------------------------------------------------------------------- */
  OS.register('cardTableRset', function (host) {
    const cards = [
      { id: 0, dirty: false, range: '0-512B' },
      { id: 1, dirty: false, range: '512B-1KB' },
      { id: 2, dirty: true, range: '1KB-1.5KB' }, // points to young obj
      { id: 3, dirty: false, range: '1.5KB-2KB' },
      { id: 4, dirty: false, range: '2KB-2.5KB' }
    ];
    let logMsg = 'Card Table: Byte array where 1 byte corresponds to 512 bytes of Old Gen memory. Dirty cards mark cross-generational pointers.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Old Object Writes Pointer to Young Object', () => {
      cards[0].dirty = true;
      logMsg = 'CARD MARKED DIRTY: JIT write barrier executed CARD_TABLE[old_addr >> 9] = 0. Card #0 marked DIRTY (0).';
      render();
    }, { primary: true });

    OS.button(controls, 'Run Minor GC (Scan Dirty Cards Only)', () => {
      const dirtyCards = cards.filter(c => c.dirty).length;
      cards.forEach(c => c.dirty = false);
      logMsg = `MINOR GC COMPLETED: Scanned only ${dirtyCards} dirty cards in Old Gen as GC roots. Bypassed 99.9% of Old Gen heap!`;
      render();
    });

    OS.button(controls, 'Reset Card Table', () => {
      cards[0].dirty = false;
      cards[1].dirty = false;
      cards[2].dirty = true;
      cards[3].dirty = false;
      cards[4].dirty = false;
      logMsg = 'Card table reset.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('Cross-Generational Card Table: 512-Byte Granularity Dirty Cards', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = logMsg.includes('DIRTY') ? OS.C.amber : OS.C.green;
        ctx.fillText(logMsg, 16, 46);

        // Draw Cards
        const cardW = Math.min(85, (w - 60) / cards.length);
        const cardH = 75;
        const startY = 80;

        cards.forEach((c, idx) => {
          const cx = 16 + idx * (cardW + 12);

          ctx.fillStyle = c.dirty ? OS.rgba(OS.C.amber, 0.25) : OS.rgba(OS.C.muted, 0.08);
          ctx.strokeStyle = c.dirty ? OS.C.amber : OS.C.border;
          ctx.lineWidth = c.dirty ? 2 : 1;
          ctx.beginPath();
          ctx.roundRect(cx, startY, cardW, cardH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(10, 'mono', 700);
          ctx.fillText(`Card #${c.id}`, cx + 8, startY + 22);

          ctx.font = OS.font(9, 'mono', 600);
          ctx.fillStyle = c.dirty ? OS.C.amber : OS.C.green;
          ctx.fillText(c.dirty ? '0x00 (DIRTY)' : '0x01 (CLEAN)', cx + 8, startY + 45);

          ctx.font = OS.font(8, 'sans', 400);
          ctx.fillStyle = OS.C.muted;
          ctx.fillText(c.range, cx + 8, startY + 62);
        });

        // Footer
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Old-to-Young references are logged in Remembered Sets (RSets) to allow fast isolated Young collections.', 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 07. Thread-Local Allocation Buffers (TLAB) & Bump Pointer
   * -------------------------------------------------------------------------- */
  OS.register('tlabAllocation', function (host) {
    let tlabUsedKb = 180;
    let tlabSizeKb = 256;
    let threadAllocCount = 1240;
    let tlabRefills = 4;
    let statusMsg = 'TLAB: Each Java thread receives a private Thread-Local Allocation Buffer inside Eden. Zero lock contention!';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Thread Allocates 32KB Object', () => {
      tlabUsedKb += 32;
      threadAllocCount++;
      if (tlabUsedKb >= tlabSizeKb) {
        statusMsg = 'TLAB REFILL: Current TLAB full! Thread took atomic CAS lock on Eden heap to allocate fresh 256KB TLAB chunk.';
        tlabUsedKb = 32;
        tlabRefills++;
      } else {
        statusMsg = `BUMP-THE-POINTER: Fast inline assembly (top += 32KB). Instant lock-free allocation in thread TLAB!`;
      }
      render();
    }, { primary: true });

    OS.button(controls, 'Simulate Huge 1MB Object (Bypass TLAB)', () => {
      statusMsg = 'TLAB BYPASS: Object exceeds TLAB size threshold! Allocated directly in Eden / Humongous region via atomic CAS.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('HotSpot TLAB (Thread-Local Allocation Buffer) & Bump-the-Pointer', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = statusMsg.includes('REFILL') || statusMsg.includes('BYPASS') ? OS.C.amber : OS.C.green;
        ctx.fillText(statusMsg, 16, 46);

        // Draw TLAB bar
        const barX = 16;
        const barY = 80;
        const barW = Math.min(480, w - 32);
        const barH = 36;

        ctx.fillStyle = OS.rgba(OS.C.accent, 0.1);
        ctx.strokeStyle = OS.C.accent;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 4);
        ctx.fill();
        ctx.stroke();

        const usedW = (tlabUsedKb / tlabSizeKb) * barW;
        ctx.fillStyle = OS.C.accent;
        ctx.fillRect(barX, barY, usedW, barH);

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillText(`TLAB Allocation: ${tlabUsedKb}KB / ${tlabSizeKb}KB (${Math.round((tlabUsedKb / tlabSizeKb) * 100)}%)`, barX + 8, barY + 22);

        // Pointers markers
        ctx.font = OS.font(9, 'mono', 500);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('start', barX, barY + barH + 18);
        ctx.fillStyle = OS.C.accent;
        ctx.fillText(`▲ top (${tlabUsedKb}K)`, Math.min(barW - 80, barX + usedW - 30), barY + barH + 18);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('end (256K)', barX + barW - 60, barY + barH + 18);

        // Stats card
        const cardY = barY + barH + 34;
        ctx.font = OS.font(10, 'mono', 500);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Total Thread Allocations: ${threadAllocCount} | TLAB Refills: ${tlabRefills} | Contention: ZERO`, 16, cardY);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 08. CMS & Premature Promotion / Concurrent Mode Failure
   * -------------------------------------------------------------------------- */
  OS.register('cmsFailure', function (host) {
    let oldGenUsedMb = 750;
    let oldGenCapMb = 800;
    let state = 'NORMAL'; // 'NORMAL', 'CONCURRENT_MARK', 'FAILURE_STW'
    let failureMsg = 'CMS Collector: Marks concurrently with mutator threads. Generates floating garbage and memory fragmentation.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Burst Young Promotion (100MB)', () => {
      oldGenUsedMb += 100;
      if (oldGenUsedMb >= oldGenCapMb) {
        state = 'FAILURE_STW';
        failureMsg = '🚨 CONCURRENT MODE FAILURE: Old Gen filled up before concurrent CMS sweep finished! Fallback to full STW Mark-Compact (15s freeze)!';
      } else {
        failureMsg = `Promoted 100MB into Old Gen (${oldGenUsedMb}MB / ${oldGenCapMb}MB). Concurrent mark running.`;
      }
      render();
    }, { primary: true });

    OS.button(controls, 'Run Concurrent CMS Sweep', () => {
      if (state !== 'FAILURE_STW') {
        oldGenUsedMb = Math.max(200, oldGenUsedMb - 300);
        failureMsg = '✓ CMS CONCURRENT SWEEP FINISHED: Reclaimed 300MB garbage without stopping mutator threads.';
      }
      render();
    });

    OS.button(controls, 'Recover & Reset CMS Heap', () => {
      oldGenUsedMb = 400;
      state = 'NORMAL';
      failureMsg = 'CMS state reset.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('CMS (Concurrent Mark Sweep): Floating Garbage & Concurrent Mode Failure', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = state === 'FAILURE_STW' ? OS.C.red : (oldGenUsedMb > 650 ? OS.C.amber : OS.C.green);
        ctx.fillText(failureMsg, 16, 46);

        // Old Gen Gauge
        const barX = 16;
        const barY = 75;
        const barW = Math.min(480, w - 32);
        const barH = 36;

        ctx.fillStyle = OS.rgba(OS.C.muted, 0.1);
        ctx.strokeStyle = OS.C.border;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 4);
        ctx.fill();
        ctx.stroke();

        const usedW = Math.min(barW, (oldGenUsedMb / oldGenCapMb) * barW);
        ctx.fillStyle = state === 'FAILURE_STW' ? OS.C.red : (oldGenUsedMb > 650 ? OS.C.amber : OS.C.accent);
        ctx.fillRect(barX, barY, usedW, barH);

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillText(`Old Gen Occupancy: ${oldGenUsedMb}MB / ${oldGenCapMb}MB (${Math.round((oldGenUsedMb / oldGenCapMb) * 100)}%)`, barX + 8, barY + 22);

        // Description
        const cardY = barY + barH + 28;
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Why CMS was deprecated (JEP 291): Non-compacting free lists cause unrecoverable fragmentation and long STW fails.', 16, cardY);
      }
    });
    render();
  });

})();
