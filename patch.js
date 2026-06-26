const fs = require('fs');
let code = fs.readFileSync('src/pages/SettingsCenter/LineIntegration.tsx', 'utf8');

const startIdx = code.indexOf('{/* TEMPLATES */}');
const endIdx = code.indexOf('{/* SIMULATOR COLUMN */}');

if (startIdx !== -1 && endIdx !== -1) {
  code = code.slice(0, startIdx) + code.slice(endIdx);
  fs.writeFileSync('src/pages/SettingsCenter/LineIntegration.tsx', code);
  console.log('Patched UI sections successfully');
} else {
  console.log('Could not find markers');
}
