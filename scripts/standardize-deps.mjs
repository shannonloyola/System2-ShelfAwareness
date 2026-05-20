import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const rootDir = process.cwd();

// Define package standardization matrix
const standardizationMatrix = {
  "@supabase/supabase-js": "^2.100.1",
  "express": "^4.21.0",
  "typescript": "^5.7.3",
  "jest": "^29.7.0",
  "ts-jest": "^29.2.0",
  "dotenv": "^16.4.5",
  "helmet": "^8.1.0",
  "cors": "^2.8.5"
};

// 1. Recursive helper to locate all package.json files
function findPackageJsonFiles(dir, fileList = []) {
  const files = readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = join(dir, file.name);
    
    if (file.isDirectory()) {
      if (file.name === "node_modules" || file.name === ".git" || file.name === "dist") {
        continue;
      }
      findPackageJsonFiles(filePath, fileList);
    } else if (file.name === "package.json") {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

// 2. Perform updates
const packageJsons = findPackageJsonFiles(rootDir);
console.log(`Found ${packageJsons.length} package.json files in repository. Scanning...`);

let totalUpdated = 0;

for (const filePath of packageJsons) {
  try {
    const rawContent = readFileSync(filePath, "utf-8");
    const json = JSON.parse(rawContent);
    let isModified = false;
    let fileUpdates = [];

    const depSections = ["dependencies", "devDependencies", "peerDependencies"];

    for (const section of depSections) {
      if (json[section]) {
        for (const [pkg, targetVersion] of Object.entries(standardizationMatrix)) {
          if (json[section][pkg] !== undefined) {
            const currentVersion = json[section][pkg];
            if (currentVersion !== targetVersion) {
              json[section][pkg] = targetVersion;
              isModified = true;
              fileUpdates.push(`   - [${section}] ${pkg}: ${currentVersion} ──► ${targetVersion}`);
            }
          }
        }
      }
    }

    if (isModified) {
      // Preserve formatting (indentation)
      const indent = rawContent.match(/^\{\r?\n(\s+)/)?.[1] || "  ";
      const formatted = JSON.stringify(json, null, indent) + "\n";
      writeFileSync(filePath, formatted, "utf-8");
      
      console.log(`\n✅ Updated: ${filePath}`);
      fileUpdates.forEach(update => console.log(update));
      totalUpdated++;
    }
  } catch (err) {
    console.error(`❌ Failed to parse or update ${filePath}:`, err.message);
  }
}

console.log(`\nFinished! Updated ${totalUpdated} package.json files.`);
