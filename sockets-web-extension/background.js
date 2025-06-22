addEventListener("install", async (e) => {
  console.log(e.type);
  e.addRoutes({
    condition: {
      urlPattern: new URLPattern({ hostname: "*" }),
    },
    source: "fetch-event",
  });
  e.waitUntil(self.skipWaiting());
});

addEventListener("activate", async (e) => {
  console.log(e.type);
  e.waitUntil(self.clients.claim());
});

addEventListener("message", async (e) => {
  console.log(e.type, e.data);
});

addEventListener("fetch", async (e) => {
  console.log(e);
  e.respondWith(fetch(e.request.url, {
    cache: "no-store",
    headers: {
      "pragma": "no-cache",
      "cache-control": "no-cache",
      "access-control-allow-origin": "*",
    },
  }));
});

chrome.windows.onRemoved.addListener((id) => {
  console.log(id);
  globalThis.nativeMessagingPort?.disconnect();
}, { windowTypes: ["app"] });

globalThis.ports = new Map([["web", null], ["iwa", null]]);
globalThis.nativeMessagingPort;
globalThis.iwaWindow;
globalThis.socketOptions;
globalThis.encoder = new TextEncoder();

function createTransformMessageStream() {
  globalThis.externalPromise = Promise.withResolvers();
  globalThis.transformStream = new TransformStream();

  globalThis.transformStream.readable.pipeTo(
    new WritableStream({
      async start() {
        console.log("start");
        return globalThis.externalPromise.promise;
      },
      write(data) {
        ports.get("iwa").postMessage(data);
      },
      close() {
        console.log("transformStreamWriter closed");
      },
    }),
  );

  globalThis.transformStreamWriter = globalThis.transformStream.writable
    .getWriter();
}
const IWA_BASE_URL = "";
chrome.runtime.onConnectExternal.addListener(async (port) => {
  if (
    !globalThis.nativeMessagingPort && !globalThis.iwaWindow &&
    port.name === "web"
  ) {
    globalThis.iwaWindow = await chrome.windows.create({
      url: IWA_BASE_URL,
      height: 200,
      width: 300,
      left: 0,
      top: 0,
      focused: true,
      type: "normal",
    });
    globalThis.nativeMessagingPort = chrome.runtime.connectNative(
      chrome.runtime.getManifest().short_name,
    );

    createTransformMessageStream();
  }
  console.log(port.name);
  if (port.name === "web") {
    ports.set("web", port);
    ports.get("web")
      .onMessage.addListener(async (message, p) => {
        await globalThis.transformStreamWriter.ready;
        await globalThis.transformStreamWriter.write(
          message,
        );
      });
  }
  if (port.name === "iwa") {
    ports.set("iwa", port);
    ports.get("iwa")
      .onMessage.addListener(async (message, p) => {
        ports.get("web").postMessage(message);
      });

    globalThis.externalPromise.resolve();
  }
  ports.set(port.name, port);
  ports.get(port.name)
    .onDisconnect.addListener(async ({ name }) => {
      console.log(`${name} disconnecting`);
      globalThis.nativeMessagingPort.disconnect();
      console.log(name + " disconnected");
      for (const [, p] of ports) {
        p.disconnect();
      }
      globalThis.transformStreamWriter.close()
        .catch(console.log);
      try {
        const tab = await chrome.tabs.query({
          title: "DirectSocket",
        });
        console.log(tab);
        if (tab.length) {
          await chrome.windows.remove(tab[0].windowId);
        }
      } catch (e) {
        console.log(e);
      } finally {
        globalThis.nativeMessagingPort = null;
        globalThis.iwaWindow = null;
        ports.clear();
      }
    });
  return true;
});

chrome.scripting.unregisterContentScripts().then(() =>
  chrome.scripting
    .registerContentScripts([{
      id: "sockets",
      js: ["direct-socket.js"],
      persistAcrossSessions: true,
      matches: [
        "https://*/*",
        "http://*/*"
      ],
      runAt: "document_start",
      world: "MAIN",
    }])
).catch((e) => console.error(chrome.runtime.lastError, e));
