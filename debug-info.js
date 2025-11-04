// Debug script to identify the source of errors
// Run this with: node debug-info.js

console.log('=== IdeaSpot Debug Information ===\n');

const fs = require('fs');
const path = require('path');

// Check if Typography is imported anywhere
console.log('1. Checking for Typography imports...');
const dashboardPath = './src/screens/Dashboard/DashboardScreen.js';
const chatPath = './src/screens/Chat/ChatScreen.js';
const workspacePath = './src/screens/Workspace/WorkspaceScreen.js';
const appPath = './App.js';

const filesToCheck = [dashboardPath, chatPath, workspacePath, appPath];

filesToCheck.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const hasTypography = content.includes('Typography');
    console.log(`   ${file}: ${hasTypography ? '❌ FOUND Typography' : '✓ No Typography'}`);

    if (hasTypography) {
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('Typography')) {
          console.log(`      Line ${index + 1}: ${line.trim()}`);
        }
      });
    }
  } else {
    console.log(`   ${file}: ❌ FILE NOT FOUND`);
  }
});

// Check package.json versions
console.log('\n2. Checking package.json versions...');
const packagePath = './package.json';
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  console.log(`   react: ${packageJson.dependencies.react}`);
  console.log(`   react-native: ${packageJson.dependencies['react-native']}`);
  console.log(`   react-native-reanimated: ${packageJson.dependencies['react-native-reanimated']}`);
  console.log(`   react-native-gesture-handler: ${packageJson.dependencies['react-native-gesture-handler']}`);
  console.log(`   react-native-worklets: ${packageJson.dependencies['react-native-worklets']}`);
}

// Check for fontWeight references
console.log('\n3. Checking for fontWeight: Typography.* references...');
filesToCheck.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const regex = /fontWeight:\s*Typography\./g;
    const matches = content.match(regex);
    console.log(`   ${file}: ${matches ? '❌ FOUND ' + matches.length + ' references' : '✓ No fontWeight: Typography references'}`);
  }
});

console.log('\n=== End Debug Information ===');
