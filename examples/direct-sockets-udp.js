var socket = new DirectSocket("udp","0.0.0.0",10001);
var abortable = new AbortController();
var decoder = new TextDecoder();
var encoder = new TextEncoder();
var {readable, writable, remoteAddress, remotePort, localAddress, localPort} = await socket.opened;
console.log({
  remoteAddress,
  remotePort,
  localAddress,
  localPort,
  socket
});

Promise.allSettled([writable.closed, readable.closed])
  .then( (args, ) => console.log(args)).catch(console.error);

var reader = readable.getReader();
var writer = writable.getWriter();

async function stream(input) {
  let len = 0;
  for (let i = 0; i < input.length; i += 65507) {
    await writer.ready;
    await writer.write({
      data: input.subarray(i, i + 65507)
    });
    var {value: {data}, done} = await reader.read();
    len += data.length;
  }
  return len;
}

var binaryResult = await stream(new Uint8Array(1024 ** 2 * 7))
  .catch( (e) => e);

console.log({
  binaryResult,
});

reader.read().then(console.log);
await writer.close();
