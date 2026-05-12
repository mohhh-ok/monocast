import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), ".logs");
mkdirSync(dir, { recursive: true });
rmSync(path.join(dir, "app.jsonl"), { force: true });
