// camera_trigger_nonproc_test.js
// Zero-wiring: use Non-Procedural port (9004) for both commands & data.
// Connect once, send PL→RS→TRG, listen on same socket for numeric reply.

import net from 'net';

// ----- CONFIGURE BELOW -----
const CAMERA_IP = '192.168.1.10';
const PORT      = 9004;      // Non-procedural Command/Data port
const PROGRAM_INDEX = 1;     // Program slot (usually 1)
const PROGRAM_NO    = 1;     // Your camera's program number
const ENDING        = '\r\n';
// ----------------------------

function triggerSequence(timeout = 5000) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(PORT, CAMERA_IP, () => {
      console.log(`🔌 Connected to ${CAMERA_IP}:${PORT}`);
      // 1) Load program
      sock.write(`PL,${PROGRAM_INDEX},${PROGRAM_NO}${ENDING}`);
      // 2) Clear error/state
      sock.write(`RS${ENDING}`);
      // 3) Trigger capture
      sock.write(`TRG${ENDING}`);
    });

    let buffer = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('⏱️ Timeout waiting for measurement'));
    }, timeout);

    sock.on('data', data => {
      buffer += data.toString();
      // Split full lines by CRLF
      const parts = buffer.split(/\r?\n/);
      // Keep partial for next chunk
      buffer = parts.pop();
      for (const line of parts) {
        const txt = line.trim();
        // Debug-echo all responses
        console.log('📥 Received:', JSON.stringify(txt));
        // Try parse numeric measurement (e.g. +5.000)
        const val = parseFloat(txt);
        if (!isNaN(val)) {
          clearTimeout(timer);
          cleanup();
          return resolve(val);
        }
      }
    });

    sock.on('error', err => {
      clearTimeout(timer);
      cleanup();
      reject(err);
    });

    function cleanup() {
      clearTimeout(timer);
      sock.destroy();
    }
  });
}

(async () => {
  try {
    const result = await triggerSequence();
    console.log(`✅ Measurement: ${result}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
