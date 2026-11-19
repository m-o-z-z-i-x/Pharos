// UTILS
// -----------------------------------------------------------------------------
import * as ed25519 from "@noble/ed25519";
import { readFileSync, writeFileSync } from "node:fs";

// SEPARATOR -------------------------------------------------------------------

// signs rules/catalog.json byte for byte; the extension verifies rules/catalog.sig with the public key

const secret = Buffer.from(readFileSync(".keys/catalog.secret", "utf8").trim(), "hex");
const text = readFileSync("rules/catalog.json");
const signature = await ed25519.signAsync(new Uint8Array(text), new Uint8Array(secret));

writeFileSync("rules/catalog.sig", Buffer.from(signature).toString("hex"));

console.log("signed rules/catalog.json");