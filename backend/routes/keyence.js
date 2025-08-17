import net from 'net';

// Configuration based on your working script
const CAMERA_IP = '192.168.1.10';
const PORT = 9004;
const ENDING = '\r\n';
const TIMEOUT = 5000;

/**
 * Connects to the Keyence camera, sends a command sequence to trigger
 * an inspection, and returns the measurement result.
 * @returns {Promise<number>} A promise that resolves with the numeric measurement.
 */
export function triggerCameraAndGetData() {
  return new Promise((resolve, reject) => {
    const sock = net.connect(PORT, CAMERA_IP);
    let buffer = '';

    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error('Timeout waiting for camera measurement'));
    }, TIMEOUT);

    sock.on('connect', () => {
      console.log(`🔌 Connected to camera at ${CAMERA_IP}:${PORT}`);
      
      // 1. Reset the camera state
      const rsCmd = `RS${ENDING}`;
      console.log(`📤 Sending: ${rsCmd.trim()}`);
      sock.write(rsCmd);

      // 2. Trigger the capture
      const trgCmd = `TRG${ENDING}`;
      console.log(`📤 Sending: ${trgCmd.trim()}`);
      sock.write(trgCmd);
    });

       sock.on('data', (chunk) => {
      console.log('📥 Raw chunk:', JSON.stringify(chunk));
      buffer += chunk;

      // Split on CRLF or LF; keep the last (possibly partial) line in buffer
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();

      for (const rawLine of lines) {
        const line = rawLine.trim();

        // Skip blank or echo lines
        if (!line || line === 'RS' || line === 'TRG') {
          console.log('⏭️ Skipping echo/blank:', JSON.stringify(line));
          continue;
        }

        // We’ve got our measurement string
        console.log('✅ Measurement line:', line);
        clearTimeout(timer);
        sock.destroy();

        const tokens = line.split(',').map(s => s.trim());
        const measurements = {};
        for (let i = 0; i + 1 < tokens.length; i += 2) {
          const key = tokens[i];
                  const rawVal = tokens[i + 1];
         const num = parseFloat(rawVal);
         // If it's a valid number, store as Number; otherwise store raw string (e.g. "Pass"/"Fail")
         measurements[key] = isNaN(num) ? rawVal : num;
        }
        return resolve(measurements);
      }
    });
    sock.on('error', (err) => {
      clearTimeout(timer);
      sock.destroy();
      reject(err);
    });

    sock.on('close', () => {
        console.log('🔌 Connection closed.');
    });
  });
}