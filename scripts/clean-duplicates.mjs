import { existsSync, rmSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const publicDir = join(ROOT, "artifacts/sabaik-almasa/public");
const imagesDir = join(publicDir, "images");

// 1. Delete duplicate api/ folder in public
const apiUploads = join(publicDir, "api");
if (existsSync(apiUploads)) {
  rmSync(apiUploads, { recursive: true, force: true });
  console.log("Deleted duplicate public/api");
}

// 2. Delete legacy and unreferenced images in public and public/images
const unreferencedImages = [
  "ceo.png", "Banner-Small.png", "shareek-mawsouq.png", "good.png",
  "Banner-Big.png", "No1-Banner.png", "hawiyat-logo.png",
  "container1.jpg", "container2.jpg", "container3.jpg", "container4.jpg",
  "container-1.jpeg", "container-2.jpeg", "container-3.jpeg", "container-4.jpeg",
  "hero1.jpg", "hero2.jpg", "hero3.jpg", "hero4.jpg",
  "hero-1.jpeg", "hero-2.jpeg", "hero-3.jpeg", "hero-4.jpeg",
  "partner1.jpg", "partner2.jpg", "partner3.jpg", "partner4.jpg", "partner5.jpg", "partner6.jpg"
];

for (const file of unreferencedImages) {
  const pRoot = join(publicDir, file);
  if (existsSync(pRoot)) {
    rmSync(pRoot, { force: true });
    console.log("Deleted root file:", file);
  }
  const pImg = join(imagesDir, file);
  if (existsSync(pImg)) {
    rmSync(pImg, { force: true });
    console.log("Deleted images/ file:", file);
  }
}
