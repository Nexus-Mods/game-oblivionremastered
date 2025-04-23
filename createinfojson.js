import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function start() {
  const distFolder = path.join(__dirname, "dist");

  const packageJsonPath = path.join(__dirname, "package.json");
  const infoJsonPath = path.join(distFolder, "info.json");

  let packageJson;

  // load package.json so we can get data
  try {
    const packageData = await fs.readFile(packageJsonPath, {
      encoding: "utf8",
    });
    packageJson = JSON.parse(packageData);
  } catch (error) {
    console.error(error);
  }

  // create vortex info.json object
  const infoJson = {
    name:
      packageJson?.config?.extensionName == undefined
        ? packageJson.name
        : packageJson?.config?.extensionName,
    author: packageJson.author,
    version: packageJson.version,
    description: packageJson.description,
    lastUpdated: Date.now()
  };

  try {
    const json = JSON.stringify(infoJson);

    console.log(json);
    console.log(new Date().toTimeString());

    // write back to info.json
    await fs.writeFile(infoJsonPath, json, { encoding: "utf8" });
  } catch (err) {
    console.error(err);
  }
}

start();
