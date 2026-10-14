import app from "./app";
import { PORT } from "./config";
import { seedIfEmpty } from "./seed";

async function main() {
  await seedIfEmpty();
  app.listen(PORT, () => console.log(`Notes API running on http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});