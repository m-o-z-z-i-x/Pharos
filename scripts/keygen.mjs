// UTILS
// -----------------------------------------------------------------------------
import * as ed25519 from "@noble/ed25519";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";

// SEPARATOR -------------------------------------------------------------------

// creates the catalog signing key. the secret stays in .keys/ (git-ignored); the public key goes into src/rules/publicKey.js

const hex = (bytes) => Buffer.from(bytes).toString("hex");

mkdirSync(".keys", { recursive: true });

if (existsSync(".keys/catalog.secret")) {
  console.log("key exists, not overwriting");
} else {
  const secret = ed25519.utils.randomSecretKey();

  writeFileSync(".keys/catalog.secret", hex(secret));

  const publicKey = hex(await ed25519.getPublicKeyAsync(secret));
  const file = "src/rules/publicKey.js";
  const updated = readFileSync(file, "utf8").replace(/PUBLIC_KEY = "[0-9a-f]*"/, `PUBLIC_KEY = "${publicKey}"`);

  writeFileSync(file, updated);

  console.log("public key", publicKey);
}