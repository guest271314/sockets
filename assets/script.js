// https://codereview.stackexchange.com/a/297492/47730
document.title = "TCPSocket";
function splitHeadersAndBody(raw) {
  for (let i = 0;i < raw.length - 3; i++) {
    if (raw[i] === 13 && raw[i + 1] === 10 && raw[i + 2] === 13 && raw[i + 3] === 10) {
      const headerEnd = i + 4;
      return [
        raw.subarray(0, headerEnd),
        raw.subarray(headerEnd)
      ];
    }
  }
  throw new Error("No header/body boundary found");
}
onmessage = async (e) => {
  console.log(e);
};
onload = async () => {
  const USER_AGENT = "Built with Bun/1.2.23";
  resizeTo(300, 200);
  globalThis.encoder = new TextEncoder;
  globalThis.decoder = new TextDecoder;
  function encode(text) {
    return encoder.encode(text);
  }
  globalThis.abortable = new AbortController;
  const {
    signal
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
  let { resolve: resolveDataChannel, promise: resolveDataChannelPromise } = Promise.withResolvers();
  local.onicecandidate = async ({
    candidate
  }) => {
    if (!candidate) {
      try {
        resolve(local.localDescription.sdp);
        await scheduler.postTask(() => {}, {
          delay: 350,
          priority: "user-visible"
        });
      } catch (e) {
        console.error(e);
      }
    }
  };
  let readableController;
  let writableController;
  let channelReadable;
  let channelWritable;
  local.ondatachannel = async (e) => {
    channel = e.channel;
    const options = JSON.parse(channel.label);
    console.log(options);
    if (options.protocol === "udp") {
      globalThis.socket = new UDPSocket({
        remoteAddress: options.address,
        remotePort: options.port
      });
    } else if (options.protocol === "tcp") {
      globalThis.socket = new TCPSocket(address, port, { noDelay: true, keepAliveDelay: 60 * 60 * 24 * 1000 });
    }
    globalThis.stream = await socket.opened;
    globalThis.readable = stream.readable;
    const socketType = globalThis.socket.constructor.name;
    const { localAddress: localAddress2, localPort: localPort2, remoteAddress, remotePort } = globalThis.stream;
    document.body.insertAdjacentHTML("afterbegin", `<pre>${JSON.stringify({ localAddress: localAddress2, localPort: localPort2, remoteAddress, remotePort }, null, 2)}`);
    globalThis.writable = stream.writable;
    globalThis.writer = writable.getWriter();
    globalThis.socket.closed.then(() => console.log("Socket closed")).catch(() => console.warn("Socket error"));
    globalThis.readable.pipeTo(new WritableStream({
      start(controller) {
        console.log(`Starting ${socketType} stream.`);
      },
      async write(value) {
        await new Response(value?.data || value).body.pipeTo(channelWritable, { preventClose: true });
      },
      close() {
        console.log(`${socketType} closed`);
      },
      abort(reason) {
        console.log({
          reason
        });
      }
    }), {
      signal
    }).then(() => console.log(`${socketType} pipe closed`)).catch((e2) => console.log(e2));
    channelReadable = new ReadableStream({
      start(_) {
        return readableController = _;
      },
      cancel(reason) {}
    });
    channelWritable = new WritableStream({
      start(_) {
        return writableController = _;
      },
      write(v) {
        channel.send(v);
      },
      close() {
        channel.close();
      },
      abort(reason) {}
    });
    channelReadable.pipeTo(new WritableStream({
      async write(data) {
        await writer.write(globalThis.socket instanceof UDPSocket ? { data } : data).catch(console.log);
      }
    })).catch(() => channel.close());
    channel.onclose = async (e2) => {
      await Promise.allSettled([
        channelReadable.cancel(),
        channelWritable.close()
      ]).then(() => {}).catch(console.log);
      local.close();
      await writer.close().catch(console.log);
      abortable.abort("reason");
      close();
    };
    channel.onclosing = async (e2) => {};
    channel.onbufferedamountlow = (e2) => {};
    channel.onerror = async (e2) => {
      await Promise.allSettled([
        channelReadable.cancel(),
        channelWritable.close()
      ]).then(() => {}).catch(console.log);
    };
    channel.onmessage = async (e2) => {
      readableController.enqueue(e2.data);
    };
  };
  const serverSocket = new TCPServerSocket("0.0.0.0", {
    localPort: 44819
  });
  const {
    readable: server,
    localAddress,
    localPort
  } = await serverSocket.opened;
  let requests = 0;
  console.log({
    server
  });
  for await (const connection of server) {
    const {
      readable: client,
      writable: writable2,
      remoteAddress,
      remotePort
    } = await connection.opened;
    console.log({
      connection
    });
    console.log({
      localAddress,
      localPort,
      remoteAddress,
      remotePort
    });
    const signalingWriter = writable2.getWriter();
    for await (const request of client) {
      const requestText = decoder.decode(request);
      if (/^OPTIONS/.test(requestText)) {
        await signalingWriter.write(encode(`HTTP/1.1 204 OK\r
` + `Access-Control-Allow-Origin: *\r
` + `Access-Control-Allow-Private-Network: true\r
` + `Access-Control-Allow-Methods: *\r
` + `Access-Control-Allow-Headers: *\r
\r
`));
        continue;
      }
      if (/^(POST|query)/i.test(requestText)) {
        const [, result] = splitHeadersAndBody(request);
        console.log({
          request,
          result
        });
        await signalingWriter.write(encode(`HTTP/1.1 200 OK\r
` + `Content-Type: application/octet-stream\r
` + `Access-Control-Allow-Origin: *\r
` + `Access-Control-Allow-Private-Network: true\r
` + `Access-Control-Allow-Headers: *\r
` + `Cache-Control: no-cache\r
` + `Connection: close\r
` + `Transfer-Encoding: chunked\r
\r
`));
        const remoteSdp = decoder.decode(Uint8Array.from(result));
        await local.setRemoteDescription({
          type: "offer",
          sdp: remoteSdp
        });
        await local.setLocalDescription(await local.createAnswer());
        const localSdp = await promise;
        const data = encoder.encode(localSdp);
        const size = data.buffer.byteLength.toString(16);
        await signalingWriter.write(encode(`${size}\r
`));
        await signalingWriter.write(data.buffer);
        await signalingWriter.write(encode(`\r
`));
        await signalingWriter.write(encode(`0\r
`));
        await signalingWriter.write(encode(`\r
`));
        await signalingWriter.close();
        break;
      }
      break;
    }
    break;
  }
  serverSocket.closed.then(async () => {}).catch(console.warn);
};
