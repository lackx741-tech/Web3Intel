const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

const requiredFiles = [
  'manifest.json',
  'background.js',
  'content.js',
  'injected.js',
  'popup/popup.html',
  'popup/popup.js',
  'popup/popup.css',
  'modules/framework.js',
  'modules/dom.js',
  'modules/resources.js',
  'modules/storage.js',
  'modules/performance.js',
  'modules/security.js',
  'modules/report.js'
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function fileExists(filePath) {
  return fs.existsSync(path.join(root, filePath));
}

function testFilesExist() {
  for (const file of requiredFiles) {
    assert(fileExists(file), `Missing required file: ${file}`);
  }
}

function testManifest() {
  const manifestText = read('manifest.json');
  const manifest = JSON.parse(manifestText);

  assert(manifest.manifest_version === 3, 'manifest_version must be 3');
  assert(manifest.background && manifest.background.service_worker === 'background.js', 'background service worker path invalid');
  assert(manifest.action && manifest.action.default_popup === 'popup/popup.html', 'default popup path invalid');

  const contentScriptFiles = manifest.content_scripts?.[0]?.js || [];
  for (const file of contentScriptFiles) {
    assert(fileExists(file), `Manifest content script missing on disk: ${file}`);
  }

  const popupHtml = read('popup/popup.html');
  assert(/<script\s+src="popup\.js"><\/script>/i.test(popupHtml), 'popup HTML must reference popup.js');
  assert(/<link\s+rel="stylesheet"\s+href="popup\.css"\s*\/?/i.test(popupHtml), 'popup HTML must reference popup.css');
}

function testJavaScriptSyntax() {
  const jsFiles = [
    'background.js',
    'content.js',
    'injected.js',
    'popup/popup.js',
    'modules/framework.js',
    'modules/dom.js',
    'modules/resources.js',
    'modules/storage.js',
    'modules/performance.js',
    'modules/security.js',
    'modules/report.js'
  ];

  for (const file of jsFiles) {
    const source = read(file);
    try {
      new vm.Script(source, { filename: file });
    } catch (error) {
      throw new Error(`Syntax parse failed for ${file}: ${error.message}`);
    }
  }
}

function main() {
  testFilesExist();
  testManifest();
  testJavaScriptSyntax();
  console.log('Extension validation passed.');
}

main();
