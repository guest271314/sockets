import { bundleIsolatedWebApp, WebBundleId } from "./wbn-bundle.js";
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import * as path from "node:path";
globalThis.Buffer ??= (await import("node:buffer")).Buffer; // For Deno
const algorithm = { name: "Ed25519" };
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const script = readFileSync("./assets/script.js");
const privateKey = readFileSync("./privateKey.json");
const publicKey = readFileSync("./publicKey.json");
// https://github.com/tQsW/webcrypto-curve25519/blob/master/explainer.md
const cryptoKey = {
  privateKey: await webcrypto.subtle.importKey(
    "jwk",
    JSON.parse(decoder.decode(privateKey)),
    algorithm.name,
    true,
    ["sign"],
  ),
  publicKey: await webcrypto.subtle.importKey(
    "jwk",
    JSON.parse(decoder.decode(publicKey)),
    algorithm.name,
    true,
    ["verify"],
  ),
};

const webBundleId = await new WebBundleId(
  cryptoKey.publicKey,
).serialize();

const isolatedWebAppURL = await new WebBundleId(
  cryptoKey.publicKey,
).serializeWithIsolatedWebAppOrigin();

const { dirname } = import.meta;
const manifest = JSON.parse(
  decoder.decode(readFileSync("./sockets-web-extension/manifest.json")),
);
const host = {};
// Generate Chrome extension ID
// https://stackoverflow.com/questions/26053434
// https://gist.github.com/dfkaye/84feac3688b110e698ad3b81713414a9
async function generateIdForPath(path) {
  return [
    ...[
      ...new Uint8Array(
        await webcrypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(path),
        ),
      ),
    ].map((u8) => u8.toString(16).padStart(2, "0")).join("").slice(0, 32),
  ]
    .map((hex) => String.fromCharCode(parseInt(hex, 16) + "a".charCodeAt(0)))
    .join(
      "",
    );
}

const extensionPath = `${dirname}/sockets-web-extension`;

const id = await generateIdForPath(extensionPath);
// Write Native Messaging host manifest to NativeMessagingHosts
// in Chromium or Chrome user data directory
host.name = manifest.short_name;
host.description = manifest.description;
host.path = `${extensionPath}/${manifest.short_name}.js`;
host.type = "stdio";
host.allowed_origins = [];
host.allowed_origins.push(`chrome-extension://${id}/`);

// https://chromium.googlesource.com/chromium/src.git/+/HEAD/docs/user_data_dir.md
writeFileSync(
  `${
    dirname.split("/").slice(0, 3).join("/")
  }/.config/chromium/NativeMessagingHosts/${host.name}.json`,
  JSON.stringify(host, null, 2),
);

writeFileSync(
  `./sockets-web-extension/${manifest.short_name}.json`,
  JSON.stringify(host, null, 2),
);

writeFileSync(
  "./assets/script.js",
  decoder.decode(script).replace(
    /USER_AGENT\s=\s"?.+"/g,
    `USER_AGENT = "Built with ${navigator.userAgent}"`,
  ).replace(/EXTENSION_ID\s=\s"?.+"/g, `EXTENSION_ID = "${id}"`),
);

const { fileName, source, baseURL } = await bundleIsolatedWebApp({
  baseURL: isolatedWebAppURL,
  static: { dir: "assets" },
  formatVersion: "b2",
  output: "signed.swbn",
  integrityBlockSign: {
    webBundleId,
    isIwa: true,
    // https://github.com/GoogleChromeLabs/webbundle-plugins/blob/d251f6efbdb41cf8d37b9b7c696fd5c795cdc231/packages/rollup-plugin-webbundle/test/test.js#L408
    // wbn-sign/lib/signers/node-crypto-signing-strategy.js
    strategies: [
      new (class CustomSigningStrategy {
        async sign(data) {
          return new Uint8Array(
            await webcrypto.subtle.sign(algorithm, cryptoKey.privateKey, data),
          );
        }
        async getPublicKey() {
          return cryptoKey.publicKey;
        }
      })(),
    ],
  },
  headerOverride: {
    "access-control-allow-origin": "*"
  }
});
writeFileSync(fileName, source);

writeFileSync(
  "./sockets-web-extension/direct-socket.js",
  decoder.decode(readFileSync("./sockets-web-extension/direct-socket.js"))
    .replace(
      /EXTENSION_ID/g,
      `"${id}"`,
    ),
);

writeFileSync(
  "./sockets-web-extension/background.js",
  decoder.decode(readFileSync("./sockets-web-extension/background.js")).replace(
    /IWA_BASE_URL\s=\s"?.+"/g, ///USER_AGENT\s=\s"?.+"/g,
    `IWA_BASE_URL = "${baseURL}"`,
  ),
);

console.log(
  "\x1b[32m",
  `
Signed Web Bundle: ${fileName}, ${source.byteLength} bytes.
Isolated Web App URL: ${baseURL}. 
Web extension ID: ${id}.
`);
