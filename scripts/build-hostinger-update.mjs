#!/usr/bin/env node
/**
 * build-hostinger-update.mjs
 * ──────────────────────────
 * بناء ملفات الكود فقط لرفعها على Hostinger دون المساس بالصور وقاعدة البيانات.
 *
 * الملفات الناتجة في sabaik-update.zip:
 *   assets/       ← JS/CSS المبنية من Vite
 *   index.html    ← صفحة HTML الرئيسية
 *   sw.js         ← Service Worker لإظهار الإشعارات وفتح الرابط الصحيح
 *   notification-icon.png ← أيقونة إشعارات الهاتف
 *   api/index.php ← ملف PHP المحدَّث
 *
 * طريقة الرفع على Hostinger:
 *   1. استخرج الأرشيف
 *   2. ارفع المجلد api/ إلى public_html/api/
 *   3. ارفع assets/ و index.html إلى public_html/
 *   (لا تلمس uploads/ ولا data/)
 */

import { execSync }                  from "child_process";
import { existsSync, mkdirSync, copyFileSync, rmSync, cpSync, writeFileSync } from "fs";
import { join, dirname }             from "path";
import { fileURLToPath }             from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function step(label) {
  console.log(`\n${"─".repeat(60)}\n✦ ${label}`);
}

// ── 1. بناء الواجهة الأمامية ──────────────────────────────────────────────────
step("بناء الواجهة الأمامية (Vite)");
run(
  "PORT=19770 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/cleanflow-services run build",
  "vite build"
);

// ── 2. تجميع ملفات التحديث فقط في مجلد مؤقت ─────────────────────────────────
step("تجميع ملفات التحديث");
const STAGING = join(ROOT, "_update_staging");
rmSync(STAGING, { recursive: true, force: true });
mkdirSync(join(STAGING, "assets"),     { recursive: true });
mkdirSync(join(STAGING, "api"),        { recursive: true });

// أصول Vite
cpSync(
  join(ROOT, "artifacts/sabaik-almasa/dist/public/assets"),
  join(STAGING, "assets"),
  { recursive: true }
);
copyFileSync(
  join(ROOT, "artifacts/sabaik-almasa/dist/public/index.html"),
  join(STAGING, "index.html")
);
for (const publicFile of ["sw.js", "notification-icon.png"]) {
  const source = join(ROOT, "artifacts/sabaik-almasa/public", publicFile);
  if (existsSync(source)) {
    copyFileSync(source, join(STAGING, publicFile));
  }
}
console.log("  ✅ assets/ و index.html وملفات الإشعارات");

// ملف PHP
copyFileSync(
  join(ROOT, "build_php/api/index.php"),
  join(STAGING, "api/index.php")
);
console.log("  ✅ api/index.php");

// تعليمات رفع بسيطة
writeFileSync(join(STAGING, "UPLOAD_INSTRUCTIONS.txt"), [
  "═══════════════════════════════════════════",
  "  تعليمات الرفع على Hostinger",
  "═══════════════════════════════════════════",
  "",
  "ارفع هذه الملفات فقط إلى public_html/:",
  "  • assets/       ← مجلد كامل",
  "  • index.html    ← ملف واحد",
  "  • sw.js و notification-icon.png ← ملفات إشعارات الهاتف",
  "  • api/index.php ← ملف واحد",
  "",
  "⚠️  لا تلمس:",
  "  • data/sabaik.db   (قاعدة البيانات)",
  "  • uploads/         (الصور المرفوعة)",
  "",
  "═══════════════════════════════════════════",
].join("\n"), "utf-8");

// ── 3. ضغط الأرشيف (من داخل مجلد التجميع فقط) ────────────────────────────────
step("إنشاء sabaik-update.zip");
const ZIP_PATH = join(ROOT, "sabaik-update.zip");
rmSync(ZIP_PATH, { force: true });
// نضغط من داخل مجلد _update_staging كي يكون مسار الملفات نظيفاً
execSync(`zip -r "${ZIP_PATH}" .`, { cwd: STAGING, stdio: "inherit" });

// تنظيف
rmSync(STAGING, { recursive: true, force: true });

const sizeKb = Math.round(
  parseInt(execSync(`du -sb "${join(ROOT, "sabaik-update.zip")}"`, { cwd: ROOT }).toString()) / 1024
);
console.log(`\n${"═".repeat(60)}`);
console.log(`✅ جاهز: sabaik-update.zip (${sizeKb} KB)`);
console.log(`   يحتوي على: assets/ + index.html + sw.js + notification-icon.png + api/index.php`);
console.log(`   لا يحتوي على: uploads/ ولا data/ (بياناتك بأمان ✔)`);
console.log(`${"═".repeat(60)}\n`);
