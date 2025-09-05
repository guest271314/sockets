// https://codereview.stackexchange.com/a/297492/47730
function splitHeadersAndBody(raw) {
  for (let i = 0; i < raw.length - 3; i++) {
    if (
      raw[i] === 13 && // \r
      raw[i + 1] === 10 && // \n
      raw[i + 2] === 13 && // \r
      raw[i + 3] === 10 // \n
    ) {
      const headerEnd = i + 4;
      return [
        raw.subarray(0, headerEnd), // headers
        raw.subarray(headerEnd), // body
      ];
    }
  }
  throw new Error("No header/body boundary found");
}

onload = async () => {
  document.title = "TCPSocket";
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
  local = new RTCPeerConnection({
    sdpSemantics: "unified-plan",
    iceServers: []
  });
  [
    "signalingstatechange",
    "iceconnectionstatechange",
    "icegatheringstatechange",
  ].forEach((e) => local.addEventListener(e, console.log));

  local.onicecandidate = async ({
    candidate,
  }) => {
    if (!candidate) {
      try {
        console.log("sdp:", local.localDescription.toJSON());
        resolve(local.localDescription.sdp);

        await scheduler.postTask(() => {}, {
          delay: 350,
          priority: "user-visible",
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
        globalThis.readable.pipeTo(
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
    protocol: "tcp",
  });

  let readableController;
  let writableController;
  let channelReadable;
  let channelWritable;

  channel.onopen = async (e) => {
    console.log(e.type, e.target);

    channelReadable = new ReadableStream({
      start(_) {
        return readableController = _;
      },
      cancel(reason) {
        console.log(reason);
      },
    });

    channelWritable = new WritableStream({
      start(_) {
        return writableController = _;
      },
      write(v) {
        console.log(v);
        channel.send(v);
      },
      close() {
        console.log("channelWritable close");
        channel.close();
      },
      abort(reason) {
        console.log(reason);
      },
    });

    channelReadable.pipeTo(
      new WritableStream({
        async write(v) {
          await writer.write(v).catch(console.log);
        },
        close() {
          console.log("channelReadable close");
        }
      }),
    ).catch(() => channel.close());
  };

  channel.onclose = async (e) => {
    console.log(e.type, e.target);
    await Promise.allSettled([
      channelReadable.cancel(),
      channelWritable.close(),
    ])
      .then(() => console.log("Data Channel stream closed")).catch(console.log);
    local.close();
    await writer.close().catch(console.log);
    abortable.abort("reason");
    close();
  };

  channel.onclosing = async (e) => {
    console.log(e.type);
  };

  channel.onbufferedamountlow = (e) => {
    // console.log(e.type, channel.bufferedAmount);
  };

  channel.onerror = async (e) => {
    console.log(e.type, e.target);
    await Promise.allSettled([
      channelReadable.cancel(),
      channelWritable.close(),
    ]).then(() => console.log("Data Channel stream closed"))
      .catch(console.log);
  };

  channel.onmessage = (e) => {
    readableController.enqueue(e.data);
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
              `Access-Control-Allow-Origin: *\r\n` +
              `Access-Control-Allow-Private-Network: true\r\n` +
              `Access-Control-Allow-Headers: *\r\n\r\n`,
          ),
        );
        continue;
      }
      if (/^(POST|query)/i.test(requestText)) {
        const [, result] = splitHeadersAndBody(request);
        console.log({
          request,
          result,
        });
        await signalingWriter.write(
          encode(
            `HTTP/1.1 200 OK\r\n` +
              `Content-Type: application/octet-stream\r\n` +
              `Access-Control-Allow-Origin: *\r\n` +
              `Access-Control-Allow-Private-Network: true\r\n` +
              `Access-Control-Allow-Headers: *\r\n` +
              `Cache-Control: no-cache\r\n` +
              `Connection: close\r\n` +
              `Transfer-Encoding: chunked\r\n\r\n`,
          ),
        );

        const remoteSdp = decoder.decode(result);

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
