// camera_trigger_fullcircle.js
// Full-circle non-procedural trigger + data retrieval in one socket

import net from 'node:net';

// ----- CONFIGURE BELOW -----
const CAMERA_IP     = '192.168.1.10';
const PORT          = 9004;          // Command & Data port
const PROGRAM_INDEX = 1;             // Program slot (usually 1)
const PROGRAM_NO    = 3;             // Your camera's program number
const ENDING        = '\r\n';      // CR+LF
const TIMEOUT       = 5000;          // ms to wait for measurement
// ----------------------------

async function triggerAndGetMeasurement() {
  return new Promise((resolve, reject) => {
    const sock = net.connect(PORT, CAMERA_IP, () => {
      console.log(`🔌 Connected to ${CAMERA_IP}:${PORT}`);
      // 1) Load program
      sock.write(`PL,${PROGRAM_INDEX},${PROGRAM_NO}${ENDING}`);
      // 2) Clear state
      sock.write(`RS${ENDING}`);
      // 3) Trigger capture
      sock.write(`TRG${ENDING}`);
    });

    let buffer = '';
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error('⏱️ Timeout waiting for measurement'));
    }, TIMEOUT);

    sock.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop(); // keep incomplete
      for (const line of lines) {
        const txt = line.trim();
        console.log('📥 Received:', JSON.stringify(txt));
        const val = parseFloat(txt);
        if (!isNaN(val)) {
          clearTimeout(timer);
          sock.destroy();
          return resolve(val);
        }
      }
    });

    sock.on('error', (err) => {
      clearTimeout(timer);
      sock.destroy();
      reject(err);
    });
  });
}

// Run directly
(async () => {
  try {
    const measurement = await triggerAndGetMeasurement();
    console.log(`✅ Measurement: ${measurement}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
