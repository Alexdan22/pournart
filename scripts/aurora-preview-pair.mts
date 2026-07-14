import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { previewBindingPair } from "../src/lib/aurora/binding-preview";

const manifestPath = argument("--manifest");
const bundlePath = argument("--bundle");
if (!manifestPath || !bundlePath) {
  console.error("Usage: npm run aurora:preview -- --manifest <binding-manifest.json> --bundle <aurora-project.json>");
  process.exitCode = 2;
} else {
  const manifest = JSON.parse(readFileSync(resolve(manifestPath), "utf8")) as unknown;
  const bundleText = readFileSync(resolve(bundlePath), "utf8");
  const preview = previewBindingPair(manifest, bundleText);
  console.log(JSON.stringify(preview, null, 2));
  if (!preview.compatible) process.exitCode = 1;
}

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
