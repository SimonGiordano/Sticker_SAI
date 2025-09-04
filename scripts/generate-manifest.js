const fs = require("fs").promises;
const path = require("path");
async function main(){
  const stickersDir = path.join(__dirname, "..", "stickers");
  try{
    const files = await fs.readdir(stickersDir);
    const pngs = files.filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f)).sort();
    const outPath = path.join(stickersDir, "manifest.json");
    await fs.writeFile(outPath, JSON.stringify(pngs, null, 2), "utf8");
    console.log("manifest.json generado con", pngs.length, "archivos.");
  }catch(e){
    console.error("Error:", e.message);
    process.exit(1);
  }
}
main();
