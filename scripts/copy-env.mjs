import { copyFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const rootEnv = join(rootDir, ".env");

if (!existsSync(rootEnv)) {
  console.error("Root .env not found!");
  process.exit(1);
}

const targets = [
  join(rootDir, "scm", "scm-frontend"),
  join(rootDir, "scm", "scm-backend", "backend"),
];

const servicesDir = join(rootDir, "scm", "scm-backend", "services");
if (existsSync(servicesDir)) {
  const services = readdirSync(servicesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => join(servicesDir, dirent.name));
  
  for (const servicePath of services) {
    if (existsSync(join(servicePath, "package.json"))) {
      targets.push(servicePath);
    }
  }
}

console.log(`Copying .env to ${targets.length} directories...`);
for (const target of targets) {
  try {
    copyFileSync(rootEnv, join(target, ".env"));
    console.log(` - Copied to: ${target}`);
  } catch (err) {
    console.error(`Failed to copy to ${target}:`, err);
  }
}
console.log("Environment files populated!");
