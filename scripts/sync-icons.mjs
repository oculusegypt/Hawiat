import { copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const pubDir = join(ROOT, "artifacts/sabaik-almasa/public");
const logoSrc = join(pubDir, "logo.png");

if (existsSync(logoSrc)) {
  copyFileSync(logoSrc, join(pubDir, "images/logo.png"));
  copyFileSync(logoSrc, join(pubDir, "uploads/1786576602625-1e9aa3b17cae.png"));
  console.log("✅ logo.png copied to images/logo.png and uploads/1786576602625-1e9aa3b17cae.png");
}
