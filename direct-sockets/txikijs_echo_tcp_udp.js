#!/usr/bin/env -S /home/user/bin/tjs run
// txiki.js Native Messaging host
// Direct Sockets TCPServerSocket, UDPSocket
// guest271314

if (!Object.hasOwn(globalThis, "process")) {
  if (navigator.userAgent.startsWith("txiki.js")) {
    Object.assign(globalThis, {
      process: {
        stdin: tjs.stdin,
        stdout: tjs.stdout.getWriter(),
        exit: tjs.exit,
      },
      gc: tjs.engine.gc.run,
    });
  }
}

process.stdout?._handle?.setBlocking?.(true);
process.stdin?._handle?.setBlocking?.(true);

const ab = new ArrayBuffer(0, {
  maxByteLength: 1024 ** 2 * 64,
});
const encoder = new TextEncoder();
let totalMessageLength = 0;
let currentMessageLength = 0;

function encodeMessage(message) {
  return encoder.encode(JSON.stringify(message));
}

async function* getMessage() {
  for await (const data of process.stdin) {
    const chunk = data;
    if (
      ab.byteLength === 0 && totalMessageLength === 0 &&
      currentMessageLength === 0
    ) {
      totalMessageLength = new DataView(chunk.buffer, chunk.byteOffset, 4)
        .getUint32(0, true);
      ab.resize(totalMessageLength);
      const message = chunk.subarray(4);
      new Uint8Array(ab).set(message, currentMessageLength);
      currentMessageLength += message.length;
    } else {
      if (currentMessageLength < totalMessageLength) {
        const u8 = new Uint8Array(ab);
        u8.set(chunk, currentMessageLength);
        currentMessageLength += chunk.length;
      }
    }
    if (currentMessageLength === totalMessageLength) {
      yield new Uint8Array(ab);
      currentMessageLength = 0;
      totalMessageLength = 0;
      ab.resize(0);
      if (typeof gc === "function") gc();
    }
  }
}

async function sendMessage(message) {
  const COMMA = 44;
  const OPEN_BRACKET = 91;
  const CLOSE_BRACKET = 93;
  const CHUNK_SIZE = 1024 * 1024;
  if (message.length <= CHUNK_SIZE) {
    await process.stdout.write(
      new Uint8Array(
        new Uint32Array([
          message.length,
        ]).buffer,
      ),
    );
    await process.stdout.write(message);
    return;
  }
  let index = 0;
  while (index < message.length) {
    let splitIndex;
    let searchStart = index + CHUNK_SIZE - 8;
    if (searchStart >= message.length) {
      splitIndex = message.length;
    } else {
      splitIndex = message.indexOf(COMMA, searchStart);
      if (splitIndex === -1) {
        splitIndex = message.length;
      }
    }
    const rawChunk = message.subarray(index, splitIndex);
    const startByte = rawChunk[0];
    const endByte = rawChunk[rawChunk.length - 1];
    let prepend = null;
    let append = null;
    if (startByte === OPEN_BRACKET && endByte !== CLOSE_BRACKET) {
      append = CLOSE_BRACKET;
    } else if (startByte === COMMA) {
      prepend = OPEN_BRACKET;
      if (endByte !== CLOSE_BRACKET) {
        append = CLOSE_BRACKET;
      }
    }
    let bodyLength = rawChunk.length;
    let sourceOffset = 0;
    if (startByte === COMMA) {
      sourceOffset = 1;
      bodyLength -= 1;
    }
    const totalLength = 4 + (prepend !== null ? 1 : 0) + bodyLength +
      (append !== null ? 1 : 0);
    const output = new Uint8Array(totalLength);
    const dataPayloadLen = totalLength - 4;
    output[0] = dataPayloadLen >> 0 & 255;
    output[1] = dataPayloadLen >> 8 & 255;
    output[2] = dataPayloadLen >> 16 & 255;
    output[3] = dataPayloadLen >> 24 & 255;
    let cursor = 4;
    if (prepend !== null) {
      output[cursor] = prepend;
      cursor++;
    } else if (startByte === COMMA) {
      output[cursor] = OPEN_BRACKET;
      cursor++;
    }
    output.set(rawChunk.subarray(sourceOffset), cursor);
    cursor += bodyLength;
    if (append !== null) {
      output[cursor] = append;
    }
    await process.stdout.write(output);
    index = splitIndex;
  }
}

(async () => {
  const socket = new UDPSocket({ localAddress: "127.0.0.1", localPort: 8000 });
  const { readable, writable, localAddress, localPort } = await socket.opened;
  
  await sendMessage(
    encodeMessage(`Listening on UDP ${localAddress}:${localPort}`),
  );
  
  const writer = writable.getWriter();
  await readable.pipeTo(
    new WritableStream({
      async write({ data, remoteAddress, remotePort }) {
        await writer.write({ data, remoteAddress, remotePort });
      },
    }),
  ).catch((e) => {
    sendMesage(encodeMessage(e.stack));
    process.exit(1);
  });
})();

(async () => {
  const socket = new TCPServerSocket("127.0.0.1", { localPort: 8000 });
  const { readable, localAddress, localPort } = await socket.opened;
  
  await sendMessage(
    encodeMessage(`Listening on TCP ${localAddress}:${localPort}`)
  );
  
  await readable.pipeTo(
    new WritableStream({
      async write(connection) {
        const { readable: client, writable, remoteAddress, remotePort } =
          await connection.opened;
        const writer = writable.getWriter();
        await client.pipeTo(
          new WritableStream({
            async write(data) {
              await writer.write(data);
            },
          }),
        );
      },
    }),
  ).catch((e) => {
    sendMesage(encodeMessage(e.stack));
    process.exit(1);
  });
})();

/**
 * Main execution entry point
 */
async function main() {
  for await (const message of getMessage()) {
    await sendMessage(message);
  }
}

main().catch((e) => {
  sendMessage(encodeMessage(e.stack));
  process.exit(1);
});
