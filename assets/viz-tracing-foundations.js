/* ==========================================================================
   Garbage Collection, Heap by Heap — Tracing & Memory Foundations
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 00. Hero: The Garbage Collection Tradeoff Triangle Arena
   * -------------------------------------------------------------------------- */
  OS.register('gcHero', function (host) {
    let collector = 'G1GC'; // 'PARALLEL', 'G1GC', 'ZGC'
    let throughput = 95; // %
    let maxPauseMs = 150;
    let memoryFootprintOverhead = 15; // %
    let heroMsg = 'G1GC (Garbage-First): Balanced enterprise collector. Predictable pause targets (200ms) with high throughput.';

    function updateProfile() {
      if (collector === 'PARALLEL') {
        throughput = 98.5;
        maxPauseMs = 1850; // Big STW pauses
        memoryFootprintOverhead = 5;
        heroMsg = 'Parallel GC (Throughput Collector): Maximum application throughput; long Stop-The-World (STW) pauses for batch jobs.';
      } else if (collector === 'G1GC') {
        throughput = 94.0;
        maxPauseMs = 120;
        memoryFootprintOverhead = 18;
        heroMsg = 'G1GC: Divides heap into 2048 regions. Evacuates highest-garbage regions first to meet user pause target.';
      } else {
        // ZGC
        throughput = 89.0;
        maxPauseMs = 1.2; // Sub-millisecond pauses!
        memoryFootprintOverhead = 25;
        heroMsg = 'ZGC (Ultra-Low Latency): Sub-millisecond pauses (<1ms) on terabyte heaps using colored pointers and load barriers!';
      }
      render();
    }

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.select(controls, 'Collector Architecture', [
      { value: 'G1GC', label: 'G1GC (Garbage-First: Balanced Throughput & P99 Pause)' },
      { value: 'ZGC', label: 'ZGC (Generational ZGC: Sub-millisecond Pauses on TB Heaps)' },
      { value: 'PARALLEL', label: 'Parallel GC (Throughput Collector: High Batch Speed, Long STW)' }
    ], (val) => {
      collector = val;
      updateProfile();
    });

    OS.button(controls, 'Simulate Heavy 50GB Heap Load', () => {
      if (collector === 'PARALLEL') maxPauseMs = 3400;
      else if (collector === 'G1GC') maxPauseMs = 180;
      else maxPauseMs = 1.8;
      heroMsg = `50GB HEAP ALLOCATION SPIKE: ${collector} max pause: ${maxPauseMs}ms.`;
      render();
    }, { primary: true });

    cv = OS.canvas(host, {
      height: 260,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('The Fundamental Garbage Collection Tradeoff Triangle', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = maxPauseMs > 500 ? OS.C.red : (maxPauseMs > 10 ? OS.C.amber : OS.C.green);
        ctx.fillText(heroMsg, 16, 46);

        // 3 Pillars Bar Chart
        const barW = Math.min(130, (w - 60) / 3);
        const barH = 120;
        const startY = 80;

        // Pillar 1: Throughput
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.15);
        ctx.strokeStyle = OS.C.accent;
        ctx.beginPath();
        ctx.roundRect(16, startY, barW, barH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('1. Throughput', 26, startY + 24);
        ctx.font = OS.font(16, 'mono', 800);
        ctx.fillStyle = OS.C.accent;
        ctx.fillText(`${throughput}%`, 26, startY + 54);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('App execution ratio', 26, startY + 76);

        // Pillar 2: Max Pause Latency
        const x2 = 16 + barW + 14;
        ctx.fillStyle = maxPauseMs > 500 ? OS.rgba(OS.C.red, 0.15) : OS.rgba(OS.C.green, 0.15);
        ctx.strokeStyle = maxPauseMs > 500 ? OS.C.red : OS.C.green;
        ctx.beginPath();
        ctx.roundRect(x2, startY, barW, barH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('2. Max Pause', x2 + 10, startY + 24);
        ctx.font = OS.font(16, 'mono', 800);
        ctx.fillStyle = maxPauseMs > 500 ? OS.C.red : OS.C.green;
        ctx.fillText(`${maxPauseMs} ms`, x2 + 10, startY + 54);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Stop-The-World (STW)', x2 + 10, startY + 76);

        // Pillar 3: Memory Footprint Overhead
        const x3 = x2 + barW + 14;
        ctx.fillStyle = OS.rgba(OS.C.amber, 0.15);
        ctx.strokeStyle = OS.C.amber;
        ctx.beginPath();
        ctx.roundRect(x3, startY, barW, barH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('3. Footprint', x3 + 10, startY + 24);
        ctx.font = OS.font(16, 'mono', 800);
        ctx.fillStyle = OS.C.amber;
        ctx.fillText(`+${memoryFootprintOverhead}%`, x3 + 10, startY + 54);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Metadata & RSets', x3 + 10, startY + 76);

        // Footer
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Tradeoff: You can optimize any two of (Throughput, Latency, Footprint), but never all three simultaneously.', 16, h - 16);
      }
    });
    updateProfile();
  });

  /* --------------------------------------------------------------------------
   * 01. Reference Counting vs Tracing: Cyclic Reference Leakage
   * -------------------------------------------------------------------------- */
  OS.register('refCountingCycles', function (host) {
    let hasCycle = true;
    let rootReachable = false;
    let objA_rc = 1; // from B
    let objB_rc = 1; // from A
    let statusText = 'Cyclic Reference Deadlock: ObjA and ObjB point to each other. Neither is reachable from Root, but RC=1 prevents deallocation!';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Run Tracing GC (Mark-Sweep)', () => {
      // Tracing starts from GC roots
      if (!rootReachable) {
        statusText = '✓ TRACING GC SUCCESS: Traced from Roots. ObjA & ObjB are unreachable -> Reclaimed both circular objects!';
        objA_rc = 0; objB_rc = 0;
      }
      render();
    }, { primary: true });

    OS.button(controls, 'Break Cyclic Pointer (ObjA.ref = null)', () => {
      hasCycle = false;
      objB_rc = 0; // B drops to 0
      objA_rc = 0; // cascading free drops A to 0
      statusText = 'CYCLE BROKEN: ObjB RC dropped to 0 -> Freed. Cascaded decrement dropped ObjA RC to 0 -> Freed.';
      render();
    });

    OS.button(controls, 'Reset Circular Dependency', () => {
      hasCycle = true;
      rootReachable = false;
      objA_rc = 1; objB_rc = 1;
      statusText = 'Reset circular references: ObjA <-> ObjB.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('Reference Counting Vulnerability: Island of Isolation Cycles', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = (objA_rc > 0 && !rootReachable) ? OS.C.red : OS.C.green;
        ctx.fillText(statusText, 16, 46);

        // Draw Root, ObjA, ObjB
        const cardW = 95;
        const cardH = 80;
        const startY = 85;

        // GC Root (Disconnected)
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.15);
        ctx.strokeStyle = OS.C.accent;
        ctx.beginPath();
        ctx.roundRect(16, startY, cardW, cardH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('GC Root', 26, startY + 24);
        ctx.font = OS.font(9, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Stack Frame', 26, startY + 45);
        ctx.fillText('Pointer = null', 26, startY + 62);

        // Obj A
        const ax = 160;
        const isDeadA = objA_rc === 0;
        ctx.fillStyle = isDeadA ? OS.rgba(OS.C.muted, 0.05) : OS.rgba(OS.C.red, 0.15);
        ctx.strokeStyle = isDeadA ? OS.C.border : OS.C.red;
        ctx.beginPath();
        ctx.roundRect(ax, startY, cardW, cardH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('Object A', ax + 10, startY + 24);
        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillStyle = isDeadA ? OS.C.muted : OS.C.red;
        ctx.fillText(`RC: ${objA_rc}`, ax + 10, startY + 48);
        ctx.font = OS.font(9, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(isDeadA ? 'RECLAIMED' : 'Points -> B', ax + 10, startY + 68);

        // Obj B
        const bx = ax + cardW + 40;
        const isDeadB = objB_rc === 0;
        ctx.fillStyle = isDeadB ? OS.rgba(OS.C.muted, 0.05) : OS.rgba(OS.C.red, 0.15);
        ctx.strokeStyle = isDeadB ? OS.C.border : OS.C.red;
        ctx.beginPath();
        ctx.roundRect(bx, startY, cardW, cardH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('Object B', bx + 10, startY + 24);
        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillStyle = isDeadB ? OS.C.muted : OS.C.red;
        ctx.fillText(`RC: ${objB_rc}`, bx + 10, startY + 48);
        ctx.font = OS.font(9, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(isDeadB ? 'RECLAIMED' : 'Points -> A', bx + 10, startY + 68);

        // Double arrows between A and B
        if (!isDeadA && !isDeadB && hasCycle) {
          ctx.strokeStyle = OS.C.red;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(ax + cardW, startY + 30);
          ctx.lineTo(bx, startY + 30);
          ctx.moveTo(bx, startY + 55);
          ctx.lineTo(ax + cardW, startY + 55);
          ctx.stroke();
        }

        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Reference counting languages (CPython, Swift ARC) require weak references or cycle detectors to reclaim cyclic graphs.', 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 02. Tri-Color Marking Invariants: White, Grey, Black
   * -------------------------------------------------------------------------- */
  OS.register('triColorMarking', function (host) {
    let nodes = [
      { id: 'Root', color: 'BLACK', desc: 'GC Root' },
      { id: 'Obj_A', color: 'GREY', desc: 'Referenced by Root' },
      { id: 'Obj_B', color: 'WHITE', desc: 'Unvisited Child' },
      { id: 'Obj_C', color: 'WHITE', desc: 'Dead Object' }
    ];
    let mutatorRace = false;
    let logMsg = 'Tri-Color Invariant: Black objects have been scanned; Grey objects are pending; White objects are unvisited (garbage candidates).';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Step GC Mark: Scan Grey Obj_A', () => {
      const a = nodes.find(n => n.id === 'Obj_A');
      const b = nodes.find(n => n.id === 'Obj_B');
      if (a && a.color === 'GREY') {
        a.color = 'BLACK';
        if (b && b.color === 'WHITE' && !mutatorRace) {
          b.color = 'GREY';
        }
        logMsg = 'GC STEP: Scanned Obj_A. Pushed children to Grey queue, marked Obj_A BLACK.';
      }
      render();
    }, { primary: true });

    OS.button(controls, 'Mutator Race: Point Black to White', () => {
      // Mutator writes pointer from Root (Black) to Obj_B (White) and deletes pointer from Obj_A
      mutatorRace = true;
      logMsg = '⚠️ MUTATOR RACE: Mutator pointed Black object directly to White object! Breaks Strong Tri-Color Invariant!';
      render();
    });

    OS.button(controls, 'Trigger Write Barrier (SATB)', () => {
      const b = nodes.find(n => n.id === 'Obj_B');
      if (b) b.color = 'GREY';
      mutatorRace = false;
      logMsg = '🛡️ WRITE BARRIER SAVED: Snapshot-At-The-Beginning (SATB) barrier intercepted overwrite, shading Obj_B GREY!';
      render();
    });

    OS.button(controls, 'Reset Marking Graph', () => {
      nodes[0].color = 'BLACK';
      nodes[1].color = 'GREY';
      nodes[2].color = 'WHITE';
      nodes[3].color = 'WHITE';
      mutatorRace = false;
      logMsg = 'Marking state reset.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('Tri-Color Marking Invariants: Dijkstra / Steele Abstract Marking State', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = mutatorRace ? OS.C.red : OS.C.green;
        ctx.fillText(logMsg, 16, 46);

        // Nodes
        const nodeW = Math.min(105, (w - 60) / nodes.length);
        const nodeH = 80;
        const startY = 85;

        nodes.forEach((n, idx) => {
          const nx = 16 + idx * (nodeW + 16);

          let fill = OS.rgba(OS.C.muted, 0.1);
          let border = OS.C.border;
          if (n.color === 'BLACK') {
            fill = OS.rgba(OS.C.ink, 0.15);
            border = OS.C.ink;
          } else if (n.color === 'GREY') {
            fill = OS.rgba(OS.C.amber, 0.2);
            border = OS.C.amber;
          }

          ctx.fillStyle = fill;
          ctx.strokeStyle = border;
          ctx.beginPath();
          ctx.roundRect(nx, startY, nodeW, nodeH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(11, 'mono', 700);
          ctx.fillText(n.id, nx + 8, startY + 22);

          ctx.font = OS.font(10, 'mono', 600);
          ctx.fillStyle = n.color === 'WHITE' ? OS.C.muted : (n.color === 'GREY' ? OS.C.amber : OS.C.ink);
          ctx.fillText(`[${n.color}]`, nx + 8, startY + 45);

          ctx.font = OS.font(9, 'sans', 400);
          ctx.fillStyle = OS.C.muted;
          ctx.fillText(n.desc, nx + 8, startY + 65);
        });

        // Summary footer
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Strong Invariant: No pointer exists from Black to White. Protected by compiler write barriers.', 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 03. Read vs Write Barrier Dynamics
   * -------------------------------------------------------------------------- */
  OS.register('barrierDynamics', function (host) {
    let barrierType = 'CARD_TABLE'; // 'CARD_TABLE', 'SATB_WRITE', 'LOAD_BARRIER'
    let costPerOp = '1-2 CPU instructions';
    let description = 'Post-Write Barrier (Card Marking): Every pointer write emits CARD_TABLE[addr >> 9] = 0 (marks 512B card dirty).';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.select(controls, 'Barrier Type', [
      { value: 'CARD_TABLE', label: 'Post-Write Barrier (Card Table Marking — Parallel GC / G1GC)' },
      { value: 'SATB_WRITE', label: 'Pre-Write Barrier (SATB Logging — G1GC Concurrent Mark)' },
      { value: 'LOAD_BARRIER', label: 'Read/Load Barrier (Self-Healing Pointer Testing — ZGC)' }
    ], (val) => {
      barrierType = val;
      if (val === 'CARD_TABLE') {
        costPerOp = '1-2 assembly instructions';
        description = 'Card Marking: (card_table_base + (obj >> 9)) = 0. Extremely fast assembly instruction injected after pointer write.';
      } else if (val === 'SATB_WRITE') {
        costPerOp = '4-6 instructions (checks marking active flag)';
        description = 'SATB Pre-Write: If concurrent marking active, logs old target pointer into thread-local SATB buffer.';
      } else {
        costPerOp = '2 instructions (test bit + conditional branch)';
        description = 'ZGC Load Barrier: On object dereference o.field, tests pointer color bits. Triggers self-healing relocation if old!';
      }
      render();
    });

    OS.button(controls, 'Execute Field Write / Read', () => {
      description = `EXECUTED ${barrierType}: JIT-compiled assembly barrier executed with overhead: ${costPerOp}.`;
      render();
    }, { primary: true });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`JIT-Compiled Barrier Mechanics: Card Marking vs Load Barriers`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = OS.C.green;
        ctx.fillText(description, 16, 46);

        // Assembly snippet card
        const cardX = 16;
        const cardY = 75;
        const cardW = Math.min(480, w - 32);
        const cardH = 110;

        ctx.fillStyle = OS.rgba(OS.C.accent, 0.08);
        ctx.strokeStyle = OS.C.accent;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText(`Injected Assembly Pattern (${barrierType})`, cardX + 14, cardY + 24);

        ctx.font = OS.font(10, 'mono', 500);
        ctx.fillStyle = OS.C.accent;
        if (barrierType === 'CARD_TABLE') {
          ctx.fillText('movq %rax, 16(%rdx)        ; write reference into field', cardX + 14, cardY + 50);
          ctx.fillText('shrq $9, %rdx              ; shift address by 512 bytes', cardX + 14, cardY + 70);
          ctx.fillText('movb $0, card_table(%rdx)  ; mark card byte DIRTY (0)', cardX + 14, cardY + 90);
        } else if (barrierType === 'SATB_WRITE') {
          ctx.fillText('cmpb $0, marking_active    ; check if GC marking in progress', cardX + 14, cardY + 50);
          ctx.fillText('jne  .enqueue_satb_buffer  ; jump to thread-local buffer if active', cardX + 14, cardY + 70);
          ctx.fillText('movq %rax, 16(%rdx)        ; perform pointer write', cardX + 14, cardY + 90);
        } else {
          ctx.fillText('testq $BAD_COLOR_MASK, %rax; check colored pointer metadata bits', cardX + 14, cardY + 50);
          ctx.fillText('jnz   .zgc_load_barrier_stub; self-heal pointer if color mismatch', cardX + 14, cardY + 70);
          ctx.fillText('movq  (%rax), %rcx         ; load dereferenced field directly', cardX + 14, cardY + 90);
        }

        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(`Runtime Overhead: ${costPerOp} per operation.`, 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 04. Mark-Sweep vs Mark-Compact: Sliding Compaction
   * -------------------------------------------------------------------------- */
  OS.register('markSweepCompact', function (host) {
    let mode = 'FRAGMENTED'; // 'FRAGMENTED' vs 'COMPACTED'
    let slots = [
      { id: 0, live: true, size: 32 },
      { id: 1, live: false, size: 16 }, // free gap
      { id: 2, live: true, size: 64 },
      { id: 3, live: false, size: 32 }, // free gap
      { id: 4, live: true, size: 32 },
      { id: 5, live: false, size: 48 }  // free gap
    ];
    let logMsg = 'Mark-Sweep: Leaves memory riddled with external fragmentation gaps. Large allocations fail even with ample free RAM!';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Run Sliding Mark-Compact', () => {
      mode = 'COMPACTED';
      // Slide all live objects to the left
      const liveObjects = slots.filter(s => s.live);
      slots = [
        ...liveObjects,
        { id: 3, live: false, size: 96, isUnifiedFree: true }
      ];
      logMsg = '✓ SLIDING COMPACT COMPLETE: Relocated live objects to left boundary; unified all dead gaps into one large 96KB contiguous free block!';
      render();
    }, { primary: true });

    OS.button(controls, 'Attempt 64KB Allocation', () => {
      if (mode === 'FRAGMENTED') {
        logMsg = '❌ OUT OF MEMORY: Cannot allocate 64KB block! Largest contiguous free slot is only 48KB due to external fragmentation!';
      } else {
        logMsg = '✓ ALLOCATION SUCCESS: Contiguous 96KB free space accommodates 64KB object instantly with bump pointer!';
      }
      render();
    });

    OS.button(controls, 'Reset Heap Memory', () => {
      mode = 'FRAGMENTED';
      slots = [
        { id: 0, live: true, size: 32 },
        { id: 1, live: false, size: 16 },
        { id: 2, live: true, size: 64 },
        { id: 3, live: false, size: 32 },
        { id: 4, live: true, size: 32 },
        { id: 5, live: false, size: 48 }
      ];
      logMsg = 'Heap reset to fragmented state.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Heap Layout: Mark-Sweep (Fragmented) vs Mark-Compact (Sliding Compactor)`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = logMsg.includes('OUT OF MEMORY') ? OS.C.red : (logMsg.includes('SUCCESS') || logMsg.includes('COMPACT') ? OS.C.green : OS.C.amber);
        ctx.fillText(logMsg, 16, 46);

        // Memory slots
        const startX = 16;
        const startY = 80;
        const totalW = Math.min(480, w - 32);
        const slotH = 50;

        let curX = startX;
        const totalSize = slots.reduce((acc, s) => acc + s.size, 0);

        slots.forEach((s) => {
          const sw = (s.size / totalSize) * totalW;

          ctx.fillStyle = s.live ? OS.rgba(OS.C.accent, 0.25) : OS.rgba(OS.C.muted, 0.08);
          ctx.strokeStyle = s.live ? OS.C.accent : OS.C.border;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(curX, startY, sw, slotH, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(10, 'mono', 600);
          ctx.fillText(s.live ? `Live (${s.size}K)` : `Free (${s.size}K)`, curX + 4, startY + 22);

          ctx.font = OS.font(9, 'sans', 400);
          ctx.fillStyle = s.live ? OS.C.accent : OS.C.muted;
          ctx.fillText(s.live ? 'Occupied' : 'Gap', curX + 4, startY + 40);

          curX += sw;
        });

        // Footer
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Mark-Compact requires updating every reference pointing to relocated objects across the heap.', 16, h - 16);
      }
    });
    render();
  });

})();
