// testCamera.js
import net from 'net';

const CAMERA_IP     = '192.168.1.10';
const COMMAND_PORT  = 9004;  // Data Output/Command
const DATA_PORT     = 9003;  // Data Input
const ENDING        = '\r\n';// CR+LF

async function triggerAndRead(timeout = 5000) {
  return new Promise((resolve, reject) => {
    let timer;
    let dataSock, cmdSock;

    // 1) Open data socket first so we’ll catch the next reply
    dataSock = net.connect(DATA_PORT, CAMERA_IP, () => {
      console.log(`📥 Listening for data on ${CAMERA_IP}:${DATA_PORT}`);
    });

    dataSock.on('data', raw => {
      clearTimeout(timer);
      const txt = raw.toString().trim();
      console.log('📥 Raw measurement:', JSON.stringify(txt));
      dataSock.end();
      cmdSock.destroy();
      resolve(txt);
    });

    dataSock.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });

    // 2) Once data socket is up, send the EXECUTE on the command port
    cmdSock = net.connect(COMMAND_PORT, CAMERA_IP, () => {
      console.log(`📤 Connected to ${CAMERA_IP}:${COMMAND_PORT}, sending EXECUTE`);
      cmdSock.write(`EXECUTE${ENDING}`);
    });

    cmdSock.on('error', err => {
      clearTimeout(timer);
      dataSock.destroy();
      reject(err);
    });

    // 3) Timeout handler
    timer = setTimeout(() => {
      dataSock.destroy();
      cmdSock.destroy();
      reject(new Error('⏱️  Timeout waiting for measurement'));
    }, timeout);
  });
}

// Run it
triggerAndRead()
  .then(val => console.log('✅ Done:', val))
  .catch(err => console.error('❌ Error:', err.message));
