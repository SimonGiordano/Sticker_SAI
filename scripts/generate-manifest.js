const fs = require("fs").promises;
const path = require("path");

async function walkDir(dir, baseDir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files = [];
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      const sub = await walkDir(full, baseDir);
      files = files.concat(sub);
    } else if (ent.isFile()) {
      if (/\.(png|jpg|jpeg|webp|gif)$/i.test(ent.name)) {
        const rel = path.relative(baseDir, full).replace(/\\/g, "/");
        files.push({ rel, name: ent.name });
      }
    }
  }
  return files;
}

async function main() {
  const stickersDir = path.join(__dirname, "..", "stickers");
  try {
    const raw = await walkDir(stickersDir, stickersDir);
    const manifest = raw.map(item => {
      const parts = item.rel.split("/");
      const category = parts.length > 1 ? parts[0] : "General";
      return {
        name: item.name,
        path: item.rel,
        category
      };
    }).sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    const outPath = path.join(stickersDir, "manifest.json");
    await fs.writeFile(outPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log("✅ manifest.json generado con", manifest.length, "stickers.");
  } catch (e) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
}

main();
