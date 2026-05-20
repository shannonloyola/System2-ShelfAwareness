import { spawn } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const rootDir = process.cwd();

const targetDirs = [
  rootDir,
  join(rootDir, "scm", "scm-frontend"),
  join(rootDir, "scm", "scm-backend", "backend"),
];

// Add all services
const servicesDir = join(rootDir, "scm", "scm-backend", "services");
if (existsSync(servicesDir)) {
  const services = readdirSync(servicesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => join(servicesDir, dirent.name));
  
  for (const servicePath of services) {
    if (existsSync(join(servicePath, "package.json"))) {
      targetDirs.push(servicePath);
    }
  }
}

// Add mobile if package.json exists
const mobileDir = join(rootDir, "mobile");
if (existsSync(join(mobileDir, "package.json"))) {
  targetDirs.push(mobileDir);
}
const scannerAppDir = join(rootDir, "mobile", "ScannerApp");
if (existsSync(join(scannerAppDir, "package.json"))) {
  targetDirs.push(scannerAppDir);
}

console.log(`Found ${targetDirs.length} directories to install dependencies in:`);
targetDirs.forEach(dir => console.log(` - ${dir}`));

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

async function installDir(dir) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> Starting npm install in: ${dir}`);
    const child = spawn(npmCmd, ["install", "--no-audit", "--no-fund"], {
      cwd: dir,
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`>>> Successfully installed in: ${dir}`);
        resolve();
      } else {
        console.error(`>>> Failed install in: ${dir} with exit code ${code}`);
        reject(new Error(`Exit code ${code}`));
      }
    });
  });
}

async function run() {
  for (const dir of targetDirs) {
    try {
      await installDir(dir);
    } catch (err) {
      console.error(err);
    }
  }
  console.log("\nAll installations finished!");
}

run();
