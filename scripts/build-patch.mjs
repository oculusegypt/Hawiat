import { execSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync, copyFileSync, cpSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PATCH_DIR = join(ROOT, "build_patch");
const ZIP_OUT = join(ROOT, "hawiat-update-patch.zip");

console.log("🚀 [Hawiat Micro Patch] تجهيز حزمة تحديث خفيفة (كود فقط بدون صور)...");

// 1. Rebuild frontend
console.log("▶ بناء ملفات الواجهة الأمامية المحدثة...");
execSync("pnpm --filter @workspace/cleanflow-services run build", { cwd: ROOT, stdio: "inherit" });

// 2. Clean & recreate build_patch
if (existsSync(PATCH_DIR)) rmSync(PATCH_DIR, { recursive: true, force: true });
mkdirSync(PATCH_DIR, { recursive: true });

// 3. Copy ONLY compiled JS/CSS assets and main index.html (NO images, NO uploads)
const distPublic = join(ROOT, "artifacts/sabaik-almasa/dist/public");
const assetsSrc = join(distPublic, "assets");
const assetsDst = join(PATCH_DIR, "assets");
if (existsSync(assetsSrc)) {
  cpSync(assetsSrc, assetsDst, { recursive: true });
  console.log("✓ تم نسخ ملفات JS / CSS المحدثة فقط.");
}

const indexSrc = join(distPublic, "index.html");
if (existsSync(indexSrc)) {
  copyFileSync(indexSrc, join(PATCH_DIR, "index.html"));
  console.log("✓ تم نسخ index.html.");
}

// 4. Copy PHP API router and .htaccess
const apiDir = join(PATCH_DIR, "api");
mkdirSync(apiDir, { recursive: true });
copyFileSync(join(ROOT, "scripts/api-index.php"), join(apiDir, "index.php"));

const htaccessRoot = join(ROOT, "build_php/.htaccess");
if (existsSync(htaccessRoot)) copyFileSync(htaccessRoot, join(PATCH_DIR, ".htaccess"));
const htaccessApi = join(ROOT, "build_php/api/.htaccess");
if (existsSync(htaccessApi)) copyFileSync(htaccessApi, join(apiDir, ".htaccess"));

// 5. Copy SQLite database
const dataDir = join(PATCH_DIR, "data");
mkdirSync(dataDir, { recursive: true });
const dbSrc = join(ROOT, "data/sabaik.db");
if (existsSync(dbSrc)) {
  copyFileSync(dbSrc, join(dataDir, "sabaik.db"));
  console.log("✓ تم نسخ قاعدة البيانات data/sabaik.db.");
}

// 6. Compress patch
if (existsSync(ZIP_OUT)) rmSync(ZIP_OUT, { force: true });
try {
  execSync(`powershell -Command "Compress-Archive -Path '${PATCH_DIR}\\*' -DestinationPath '${ZIP_OUT}' -Force"`, { cwd: ROOT, stdio: "inherit" });
  const sizeMb = (statSync(ZIP_OUT).size / (1024 * 1024)).toFixed(2);
  console.log(`\n🎉 تم إنشاء حزمة التحديث الخفيفة بنجاح: hawiat-update-patch.zip (الحجم: ${sizeMb} ميجابايت فقط!)`);
} catch (err) {
  console.error("فشل ضغط ملف التحديث:", err);
}
