import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert __dirname to ES module equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const componentsDir = path.join(__dirname, 'src', 'components');
const apiFunctions = {
  '/active_builds': 'getActiveBuilds',
  '/active_builds/': 'getActiveBuild',
  '/lots/': 'getLotDetails',
  '/specs/by-config-mp/': 'getSpecs',
  '/inspection_logs/': 'getInspectionLogs',
  '/yield/': 'getYield',
  '/log_inspection': 'logInspection',
  '/end_build': 'endBuild',
  '/lots/update-quantity': 'updateLotQuantity',
  '/current_user': 'getCurrentUser',
  '/login': 'login',
  '/logout': 'logout',
  '/configurations': 'getConfigurations',
  '/inspection-logs/': 'getInspectionLogsByConfig',
  '/test/normality/': 'getNormalityTest'
};

fs.readdir(componentsDir, (err, files) => {
  if (err) {
    console.error('Error reading components directory:', err);
    return;
  }

  files.forEach(file => {
    const filePath = path.join(componentsDir, file);
    if (path.extname(file) === '.js') {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading file:', err);
          return;
        }

        let updatedData = data;
        let importStatement = "import { ";

        for (const [url, func] of Object.entries(apiFunctions)) {
          const regex = new RegExp(`axios\\.(get|post)\\(['"\`]${url}`, 'g');
          if (regex.test(data)) {
            updatedData = updatedData.replace(regex, `${func}(`);
            importStatement += `${func}, `;
          }
        }

        if (importStatement !== "import { ") {
          importStatement = importStatement.slice(0, -2) + " } from './api';\n";
          updatedData = updatedData.replace(/import axios from 'axios';\n/, importStatement);
        }

        fs.writeFile(filePath, updatedData, 'utf8', err => {
          if (err) {
            console.error('Error writing file:', err);
          } else {
            console.log(`Updated ${file}`);
          }
        });
      });
    }
  });
});