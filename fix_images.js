const fs = require('fs');
const path = require('path');
const appJsPath = path.join('public', 'app.js');

const files = {
  'Ring': 'ring.jpg',
  'Necklace': 'necklace.jpg',
  'Bracelet': 'bracelet.jpg',
  'Earrings': 'earrings.jpg',
  'Nose Ring': 'nose-ring.jpg',
  'Waist Chain': 'waist-chain.jpg'
};

const categories = [];

for (const [name, filename] of Object.entries(files)) {
  const filePath = path.join('public', 'images', filename);
  const data = fs.readFileSync(filePath);
  const base64 = data.toString('base64');
  categories.push(`      { name: "${name}", image: "data:image/jpeg;base64,${base64}" }`);
}

const replacement = `const categories = [\n${categories.join(',\n')}\n    ];`;

let appJsContent = fs.readFileSync(appJsPath, 'utf8');
appJsContent = appJsContent.replace(/const categories = \[[\s\S]*?\];/, replacement);

fs.writeFileSync(appJsPath, appJsContent);
console.log('Successfully updated app.js with base64 images.');
