document.title = "DirectSocket";
const USER_AGENT = "";
const EXTENSION_ID = "";
console.log(USER_AGENT, EXTENSION_ID);

globalThis.encoder = new TextEncoder();
globalThis.nativeSocket = null;
globalThis.nativeSocketReadable = null;
globalThis.nativeSocketWritable = null;
globalThis.nativeSocketWriter = null;
globalThis.nativeSocketAbortable = null;
globalThis.socketType = "";

const port = chrome.runtime.connect(EXTENSION_ID, {
  name: "iwa",
});
port.onMessage.addListener(async (message) => {
  globalThis.socketType = message.socketType;
  if (!globalThis.nativeSocket) {
    if (message.socketType === "tcp") {
      globalThis.nativeSocket = new TCPSocket(
        message.remoteAddress,
        message.remotePort,
        { noDelay: true, keepAliveDelay: 60 * 60 * 24 * 1000 },
      );
    }
    if (message.socketType === "udp") {
      globalThis.nativeSocket = new UDPSocket({
        remoteAddress: message.remoteAddress,
        remotePort: message.remotePort,
      });
    }
    console.log(globalThis.nativeSocket);
    nativeSocket.closed.then(() => console.log("socket closed"));
    const p = await nativeSocket.opened;
    globalThis.nativeSocketReadable = p.readable;
    globalThis.nativeSocketWritable = p.writable;
    globalThis.nativeSocketAbortable = new AbortController();
    globalThis.nativeSocketWriter = globalThis.nativeSocketWritable.getWriter();
    globalThis.nativeSocketAbortable.signal.onabort = (e) => {
      globalThis.nativeSocket = null;
      globalThis.nativeSocketReadable = null;
      globalThis.nativeSocketWritable = null;
      globalThis.nativeSocketWriter = null;
      globalThis.nativeSocketAbortable = null;
    };
    globalThis.nativeSocketWriter.closed.then(() => {
      console.log("writer closed");
      if (globalThis.nativeSocketAbortable !== null) {
        globalThis.nativeSocketAbortable.abort("reason");
      }
    });

    console.log(globalThis.nativeSocket);
    globalThis.nativeSocketReadable.pipeTo(
      new WritableStream({
        start() {
          const {
            localAddress,
            localPort,
            remoteAddress,
            remotePort,
          } = p;
          port.postMessage({
            localAddress,
            localPort,
            remoteAddress,
            remotePort,
          });
          document.body.insertAdjacentHTML(
            "afterbegin",
            `<pre>${
              JSON.stringify(
                {
                  localAddress,
                  localPort,
                  remoteAddress,
                  remotePort,
                },
                null,
                2,
              )
            }
          </pre>`,
          );
        },
        write(data) {
          port.postMessage(data?.data ? data : [...data]);
        },
        close() {
          console.log("close");
        },
        abort(reason) {
          console.log(reason);
        },
      }),
      { signal: globalThis.nativeSocketAbortable.signal },
    )
      .then(() => console.log("stream closed"))
      .catch((e) => console.log("stream closed for " + e));
  } else {
    if (
      globalThis.nativeSocket instanceof UDPSocket &&
      Object.hasOwn(message, "data")
    ) {
      await globalThis.nativeSocketWriter.write(
        { data: new Uint8Array(Object.values(message.data)) },
      );
    }
    if (globalThis.nativeSocket instanceof TCPSocket) {
      await globalThis.nativeSocketWriter.write(
        new Uint8Array(message),
      );
    }
  }
});
port.onDisconnect.addListener((p) => {
  if (chrome.runtime?.lastError) {
    console.log(chrome.runtime.lastError);
  }
  console.log(p.name + " disconnected");
  try {
    globalThis.nativeSocketWriter.close();
    globalThis.nativeSocketAbortable.abort("reason");
  } catch (e) {
    console.log(e);
  }
});
