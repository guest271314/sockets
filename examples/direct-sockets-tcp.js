var socket = new DirectSocket("tcp", "guest271314.github.io", 80);
var abortable = new AbortController();
var decoder = new TextDecoder();
var {
  readable,
  writable,
  remoteAddress,
  remotePort,
  localAddress,
  localPort
} = await socket.opened;
console.log({
  remoteAddress,
  remotePort,
  localAddress,
  localPort
});
var reader = readable.getReader();
var promise = reader.read().then(function read({
  value,
  done
} = {
  value: {
    data: void 0
  },
  done: false
}) {
  if (done) return reader.closed.then(() => "Done streaming");
  console.log(decoder.decode(value?.data || value));
  return reader.read().then(read);
}).catch((e) => e.message);

await new Response(`GET / HTTP/1.1\r\n\Host:guest271314.github.io\r\n\r\n`)
  .body.pipeTo(writable, {
  preventClose: 1
});
promise
  .then((p) => {
    console.log(p);
  }).catch(console.warn);
