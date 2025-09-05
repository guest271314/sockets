#!/usr/bin/env -S tjs run
// https://github.com/saghul/txiki.js/blob/8460eaedd13225dc2ea6761a8cca7bfd2f06f6b0/tests/test-tcp.js
// https://github.com/saghul/txiki.js/blob/8460eaedd13225dc2ea6761a8cca7bfd2f06f6b0/tests/test-web-streams.js
const encoder = new TextEncoder();

const abortable = new AbortController();
const {
  signal,
} = abortable;

async function readFullAsync(length) {
  const buffer = new Uint8Array(65536);
  const data = [];
  while (data.length < length) {
    const n = await tjs.stdin.read(buffer);
    if (n === null) {
      break;
    }
    data.push(...buffer.subarray(0, n));
  }
  return new Uint8Array(data);
}

async function getMessage() {
  const header = new Uint8Array(4);
  await tjs.stdin.read(header);
  const [length] = new Uint32Array(
    header.buffer,
  );
  const output = await readFullAsync(length);
  return output;
}

async function sendMessage(message) {
  // https://stackoverflow.com/a/24777120
  const header = Uint32Array.from({
    length: 4,
  }, (_, index) => (message.length >> (index * 8)) & 0xff);
  const output = new Uint8Array(header.length + message.length);
  output.set(header, 0);
  output.set(message, 4);
  await tjs.stdout.write(output);
  return true;
}

function encodeMessage(message) {
  return encoder.encode(JSON.stringify(message));
}

const listener = await tjs.listen("tcp", "127.0.0.1", "8000");
const { family, ip, port } = listener.localAddress;
sendMessage(
  encodeMessage(`Listening on family: ${family}, ip: ${ip}, port: ${port}`),
);
(async() => {
try {
  const conn = await listener.accept();
  const writer = conn.writable.getWriter();

  await conn.readable
    .pipeTo(
      new WritableStream({
        async write(value, controller) {
          await writer.write(value);
        },
        close() {
          sendMessage(encodeMessage("Stream closed"));
        },
        abort(reason) {
          sendMesage(encodeMessage(reason));
        },
      }),
    ).then(() => sendMessage(encodeMessage("Stream aborted"))).catch((e) => {
      throw e;
    });
} catch (e) {
  sendMesage(encodeMessage(e.message));
  listener.close();
}
})();
async function main() {
  while (true) {
    try {
      const message = await getMessage();
      await sendMessage(message);
      gc();
    } catch (e) {
      sendMesage(encodeMessage(e.message));
      tjs.exit();
    }
  }
}

main();

