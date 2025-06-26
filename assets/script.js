onload = async () => {
  const USER_AGENT = "";
  console.log(USER_AGENT);
  resizeTo(300, 200);
  globalThis.encoder = new TextEncoder();
  globalThis.decoder = new TextDecoder();

  function encode(text) {
    return encoder.encode(text);
  }

  globalThis.abortable = new AbortController();
  const {
    signal,
  } = abortable;
  globalThis.signal = signal;
  globalThis.handle = null;
  globalThis.socket = null;
  globalThis.readable = null;
  globalThis.writable = null;
  globalThis.writer = null;
  globalThis.stream = null;
  globalThis.local = null;
  globalThis.channel = null;

  const { resolve, promise } = Promise.withResolvers();
  const sdp = atob(new URL(location.href).searchParams.get("sdp"));
  local = new RTCPeerConnection({
    sdpSemantics: "unified-plan",
  });
  [
    "onsignalingstatechange",
    "oniceconnectionstatechange",
    "onicegatheringstatechange",
  ].forEach((e) => local.addEventListener(e, console.log));

  local.onicecandidate = async ({
    candidate,
  }) => {
    if (!candidate) {
      try {
        console.log("sdp:", local.localDescription);
        resolve(local.localDescription.sdp);
        document.title = "TCPSocket";
        await scheduler.postTask(() => {}, {
          delay: 200,
          priority: "background",
        });
        try {
          globalThis.socket = new TCPSocket("0.0.0.0", "8000");
          globalThis.stream = await socket.opened;
          globalThis.readable = stream.readable;
          console.log(socket);
        } catch (e) {
          console.log(e);
        }
        const { localAddress, localPort, remoteAddress, remotePort } =
          globalThis.stream;
        document.body.insertAdjacentHTML(
          "afterbegin",
          `<pre>${
            JSON.stringify(
              { localAddress, localPort, remoteAddress, remotePort },
              null,
              2,
            )
          }`,
        );
        globalThis.writable = stream.writable;
        globalThis.writer = writable.getWriter();
        globalThis.socket.closed.then(() => console.log("Socket closed"))
          .catch(() => console.warn("Socket error"));
        globalThis.readable.pipeThrough(new TextDecoderStream()).pipeTo(
          new WritableStream({
            start(controller) {
              console.log("Starting TCPSocket stream.");
            },
            write(value) {
              globalThis.channel.send(value);
            },
            close() {
              console.log("TCPSocket closed");
            },
            abort(reason) {
              console.log({
                reason,
              });
            },
          }),
          {
            signal,
          },
        ).then(() => console.log("TCPSocket pipe closed")).catch((e) =>
          console.log(e)
        );
      } catch (e) {
        console.error(e);
      }
    }
  };
  channel = local.createDataChannel("transfer", {
    negotiated: true,
    ordered: true,
    id: 0,
    binaryType: "arraybuffer",
    protocol: "udp",
  });

  channel.onopen = async (e) => {
    console.log(e.type);
  };
  channel.onclose = channel.onerror = async (e) => {
    console.log(e.type);
    local.close();
    await writer.close().catch(console.log);
    abortable.abort("reason");
    close();
  };
  channel.onclosing = async (e) => {
    console.log(e.type);
  };
  channel.onmessage = async (e) => {
    console.log(e.data);
    await writer.write(e.data).catch(console.log);
  };

  const serverSocket = new TCPServerSocket("0.0.0.0", {
    localPort: 44819,
  });

  const {
    readable: server,
    localAddress,
    localPort,
  } = await serverSocket.opened;
  let requests = 0;
  console.log({
    server,
  });

  for await (const connection of server) {
    const {
      readable: client,
      writable,
      remoteAddress,
      remotePort,
    } = await connection.opened;
    console.log({
      connection,
    });
    console.log({
      localAddress,
      localPort,
      remoteAddress,
      remotePort,
    });

    const signalingWriter = writable.getWriter();
    for await (const request of client) {
      const requestText = decoder.decode(request);
      if (/^OPTIONS/.test(requestText)) {
        await signalingWriter.write(
          encode(
            `HTTP/1.1 204 OK\r\n` +
              `Access-Control-Allow-Headers: Access-Control-Request-Private-Network\r\n` +
              `Access-Control-Allow-Origin: *\r\n` +
              `Access-Control-Allow-Headers: Access-Control-Request-Private-Network\r\n\r\n`,
          ),
        );
        continue;
      }
      if (/^(POST|query)/i.test(requestText)) {
        const config = {
          key: null,
          headersRead: false,
          callback(requestBuffer, element, index) {
            // Match \r\n\r\n
            if (!this.headersRead) {
              this.headersRead = element === 13 &&
                requestBuffer.at(index + 1) === 10 &&
                requestBuffer.at(index + 2) === 13 &&
                requestBuffer.at(index + 3) === 10;
              if (this.headersRead && this.key === null) {
                this.key = index + 4;
              }
            }
            if (!this.headersRead || this.key !== null && index < this.key) {
              return "headers";
            }
            return "body";
          },
        };
        const result = Object.groupBy(
          request,
          config.callback.bind(config, request),
        );

        console.log({
          request,
          result,
        });
        await signalingWriter.write(
          encode(
            `HTTP/1.1 200 OK\r\n` +
              `Content-Type: application/octet-stream\r\n` +
              `Access-Control-Allow-Origin: *\r\n` +
              `Cache-Control: no-cache\r\n` +
              `Connection: close\r\n` +
              `Transfer-Encoding: chunked\r\n\r\n`,
          ),
        );

        const remoteSdp = decoder.decode(Uint8Array.from(result.body));

        await local.setRemoteDescription({
          type: "offer",
          sdp: remoteSdp,
        });
        await local.setLocalDescription(await local.createAnswer());

        const localSdp = await promise;
        const data = encoder.encode(localSdp);
        const size = data.buffer.byteLength.toString(16);
        await signalingWriter.write(encode(`${size}\r\n`));
        await signalingWriter.write(data.buffer);
        await signalingWriter.write(encode("\r\n"));
        await signalingWriter.write(encode("0\r\n"));
        await signalingWriter.write(encode("\r\n"));
        await signalingWriter.close();
        break;
      }
      break;
    }
    break;
  }

  serverSocket.closed.then(() => {
    console.log("TCPServerSocket closed", socket);
  }).catch(console.warn);
};
