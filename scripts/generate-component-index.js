// Exclude specific folders from processing
// This is useful for folders that do not contain components or should be ignored
const excludedFolders = new Set(['psdkupdate']);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const componentsDir = path.join(__dirname, '../src/views/components');
const outputFile = path.join(componentsDir, 'index.ts');

function findSubfolderIndexes(dir) {
  const exports = [];

  if (!fs.existsSync(dir)) {
    console.warn(`⚠️ Components directory not found: ${dir}`);
    return exports;
  }

  // Read all subfolders in the components directory
  fs.readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name)
    .filter((folderName) => !excludedFolders.has(folderName))
    // For each subfolder, check if it contains an index.ts file
    .forEach((folderName) => {
      const subfolderPath = path.join(dir, folderName);

      const indexPath = path.join(subfolderPath, 'index.ts');
      const indexTsxPath = path.join(subfolderPath, 'index.tsx');

      // Check if index.ts(x) exists in this subfolder
      const indexesPath = [indexPath, indexTsxPath].filter((filePath) => fs.existsSync(filePath));
      if (indexesPath.length > 0) {
        const itemPath = indexesPath[0];
        const componentName = generateComponentName(folderName);
        const importPath = `./${folderName}`;

        if (process.env.VERBOSE) {
          console.log(`📁 Found index file for ${componentName} in ${folderName}/: ${itemPath}`);
        }
        exports.push({
          type: 'index',
          name: componentName,
          path: importPath,
          folder: folderName,
        });
      } else {
        if (process.env.VERBOSE) {
          console.warn(`⚠️ No index.ts(x) found in subfolder: ${folderName}`);
        }

        // Fallback: search for component files in this folder
        const componentFiles = findComponentsInFolder(subfolderPath, folderName);
        exports.push(...componentFiles);
      }
    });

  return exports;
}

function findComponentsInFolder(folderPath, folderName) {
  const components = [];

  try {
    const items = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const item of items) {
      if (item.isFile()) {
        const ext = path.extname(item.name);
        const baseName = path.basename(item.name, ext);

        // Look for React component files
        if (['.tsx', '.jsx'].includes(ext)) {
          const result = shouldIncludeComponent(baseName, path.join(folderPath, item.name));
          if (result.include) {
            const componentName = generateComponentName(baseName);
            const importPath = `./${folderName}/${baseName}`;

            components.push({
              type: result.exportType === 'named' ? 'named-component' : 'component', // <== Update here!
              name: componentName,
              path: importPath,
              folder: folderName,
              file: item.name,
              namedExports: result.namedExports || [], // Optionally record named exports
            });
          } else if (process.env.VERBOSE) {
            console.warn(`⚠️ Skipping non-component file: ${item.name}`);
          }
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ Could not read folder: ${folderPath}`);
  }

  return components;
}

function shouldIncludeComponent(baseName, fullPath) {
  const lowerName = baseName.toLowerCase();

  // Skip common non-component files
  const skipPatterns = ['test', 'spec', 'story', 'stories', 'mock', 'mocks', 'style', 'styles', 'types', 'utils', 'helpers', 'constants', 'index'];
  if (skipPatterns.some((pattern) => lowerName.includes(pattern))) {
    return { include: false };
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8');

    const hasReactImport = /import.*React/i.test(content);
    const hasJSXElement = /<[A-Z][A-Za-z0-9]*[\s/>]/.test(content);

    const hasExportDefault = /export\s+default\s+/i.test(content);

    // Named export: function or const with PascalCase name
    let namedExports = [];
    const namedFunctionMatches = content.matchAll(/export\s+function\s+([A-Z][A-Za-z0-9_]*)/g);
    const namedConstMatches = content.matchAll(/export\s+const\s+([A-Z][A-Za-z0-9_]*)/g);
    for (const m of namedFunctionMatches) namedExports.push(m[1]);
    for (const m of namedConstMatches) namedExports.push(m[1]);

    // Handle "export { Name }"
    const exportBlockMatches = content.matchAll(/export\s*\{\s*([A-Z][A-Za-z0-9_,\s]+)\s*\}/g);
    for (const m of exportBlockMatches) {
      const names = m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      namedExports.push(...names);
    }

    const isComponent = hasReactImport || hasJSXElement;

    if (hasExportDefault && isComponent) {
      return { include: true, exportType: 'default' };
    } else if (namedExports.length > 0 && isComponent) {
      return { include: true, exportType: 'named', namedExports };
    }
    return { include: false };
  } catch (error) {
    return { include: false };
  }
}

function generateComponentName(name) {
  // Convert to PascalCase and handle special characters
  return name
    .replace(/[^a-zA-Z0-9]/g, ' ') // Replace special chars with spaces
    .split(' ')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

// Find all subfolder indexes and components
const allExports = findSubfolderIndexes(componentsDir);

console.log(allExports);

// Handle duplicate names
const uniqueExports = [];
const seenNames = new Set();

allExports.forEach((exp) => {
  let finalName = exp.name;
  let counter = 1;

  while (seenNames.has(finalName.toLowerCase())) {
    finalName = `${exp.name}${counter}`;
    counter++;
  }

  seenNames.add(finalName.toLowerCase());
  uniqueExports.push({ ...exp, name: finalName });
});

// Separate index exports from component exports
const indexExports = uniqueExports.filter((exp) => exp.type === 'index');
const componentExports = uniqueExports.filter((exp) => exp.type === 'component');
const namedComponentExports = uniqueExports.filter((exp) => exp.type === 'named-component');

const indexContent = `// Auto-generated component index
// Generated on: ${new Date().toISOString()}

${
  indexExports.length > 0
    ? '// Exports from subfolders with index.ts files\n' + indexExports.map((exp) => `export * from '${exp.path}'; // ${exp.folder}/`).join('\n')
    : ''
}

${
  indexExports.length > 0
    ? '\n// Re-export as named exports for convenience\n' + indexExports.map((exp) => `export * as ${exp.name} from '${exp.path}';`).join('\n')
    : ''
}

${
  componentExports.length > 0
    ? '\n// Direct component default exports (no index.ts found)\n' +
      componentExports.map((exp) => `export { default as ${exp.name} } from '${exp.path}'; // ${exp.folder}/${exp.file}`).join('\n')
    : ''
}

${
  namedComponentExports.length > 0
    ? '\n// Named component exports (no index.ts found)\n' +
      namedComponentExports
        .map((exp) => (exp.namedExports ?? []).map((name) => `export { ${name} } from '${exp.path}'; // ${exp.folder}/${exp.file}`).join('\n'))
        .join('\n')
    : ''
}

`;

// Write the index file
fs.writeFileSync(outputFile, indexContent);

console.log(`✅ Generated index.ts with ${uniqueExports.length} total exports:`);

if (indexExports.length > 0) {
  console.log(`\n📁 Folders with index.ts (${indexExports.length}):`);
  indexExports.forEach((exp) => {
    console.log(`   - ${exp.name} (from ${exp.folder}/)`);
  });
}

if (componentExports.length > 0) {
  console.log(`\n📄 Individual components with default exports (${componentExports.length}):`);
  componentExports.forEach((exp) => {
    const renamed = exp.name !== generateComponentName(path.basename(exp.file, path.extname(exp.file))) ? ` (renamed)` : '';
    console.log(`   - ${exp.name} (from ${exp.folder}/${exp.file})${renamed}`);
  });
}

// Individual components with named exports
if (namedComponentExports.length > 0) {
  let count = 0;
  namedComponentExports.forEach((exp) => {
    count += (exp.namedExports ?? []).length;
  });
  console.group(`📄 Individual components with named exports (${namedComponentExports.length} export${count !== 1 ? 's' : ''}):`);
  namedComponentExports.forEach((exp) => {
    (exp.namedExports ?? []).forEach((name) => {
      console.log(`  - ${name} (from ${exp.folder}/${exp.file})`);
    });
  });
  console.groupEnd();
}

if (uniqueExports.length === 0) {
  console.log('💡 No components found. Create index.ts files in subfolders or add .tsx/.jsx component files.');
}
