import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runPythonScript(scriptName, data) {
  return new Promise((resolve, reject) => {
    // Construct the absolute path to the script
    const scriptPath = path.join(__dirname, '..', scriptName);
    
    // THE FIX: Use 'python3' instead of 'python' to call the script.
    // This ensures compatibility with modern Linux environments where 'python'
    // may not be linked.
    const pythonProcess = spawn('python3', [scriptPath]);

    let stdout = '';
    let stderr = '';

    // Capture standard output
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Capture standard error
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle process exit
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script ${scriptName} exited with code ${code}`);
        console.error('stderr:', stderr);
        return reject(new Error(`Script Error: ${stderr}`));
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        console.error('Failed to parse Python script output as JSON:', stdout);
        reject(new Error('Failed to parse script output.'));
      }
    });
    
  
    pythonProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        reject(err);
    });

    // Send data to the Python script
    pythonProcess.stdin.write(JSON.stringify(data));
    pythonProcess.stdin.end();
  });
}
