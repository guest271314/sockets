# sockets
TCP and UDP sockets in the browser using Web extension API's and Direct Sockets from an [Isolated Web App](https://github.com/WICG/isolated-web-apps/blob/main/README.md) (IWA).

## Install dependencies

```
npm install
```

```
bun install
```
## Generate cryptographic keys for IWA

```
deno -A --import-map deno.json generateWebCryptoKeys.js
```

Write Signed Web Bundle, create Native Messaging host manifest for Node.js TCP
and UDP local server, and writes the Native Messaging host manifest to Chromium
configuration folder on Linux.

Using network imports with Deno

```
deno -A -c deno.json index.js
```

```
node index.js
```

Load the Signed Web Bundle on the command line with

```
~/chrome-linux/chrome --no-startup-window \
--password-store=basic \
--install-isolated-web-app-from-file=/home/user/sockets/signed.swbn
```

or select the `signed.swbn` file in `chrome://web-app-internals`.

Load the unpacked extension folder `sockets-web-extension` in
`chrome://extension`, or when launching `chrome` with
`--load-extension=/home/user/sockets/sockets-web-extension`.

Set `sockets.js` to executable for launching the Node.js TCP and UDP server on
the local machine in a Native Messaging host.

The Web extension injects `DirectSocket` class into all `http:` and `https:` Web
pages. When constructed `DirectSocket` class starts Node.js local server, and
opens the IWA window.

Communication between IWA window, background [MV3 `ServiceWorker`](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) in Web
extension, and user determined Web page uses [`externally_connectable`](https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable); IPC that
uses JSON-like format in Chromium browser.

The JSON from IPC is written to WHATWG Streams to implement [WICG Direct Sockets](https://wicg.github.io/direct-sockets/)
`TCPSocket` and `UDPSocket` interfaces.

Not implemented for `TCPSocketOptions`: `sendBufferSize`, `receiveBufferSize`, `dnsQueryType`.

## Usage

In DevTools in an arbitrary Web page, TCP connection to remote address. Opens a
minimal IWA window. Closing the socket closes the IWA window.

```
var socket = new DirectSocket("tcp", "52.43.121.77", 9001);
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

await new Response(`
1. If a (logical or axiomatic formal) system is consistent, it cannot be complete.
2. The consistency of axioms cannot be proved within their own system.

- Kurt Gödel, Incompleteness Theorem, On Formally Undecidable Propositions 
  of Principia Mathematica and Related Systems
`).body.pipeTo(writable, {
  preventClose: 1
});
promise
  .then((p) => {
    console.log(p);
  }).catch(console.warn);
```

```
var socket = new DirectSocket("tcp", "tcpbin.com", 4242);
var abortable = new AbortController();
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
var reader = readable.pipeThrough(new TextDecoderStream()).getReader();
var writer = writable.getWriter();
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
  console.log((value?.data || value));
  return reader.read().then(read);
}).catch((e) => e.message);

await writer.write(new TextEncoder().encode("Test TCP echo server\n"));
await writer.write(new TextEncoder().encode("TCP echo server, again\n"));
await scheduler.postTask(() => writer.close(), {delay:300});

promise
  .then((p) => {
    console.log(p);
  }).catch(console.warn);
```

TCP connection to local machine

```
var socket = new DirectSocket("tcp", "127.0.0.1", 8080);
```

Close TCP connection

```
socket.close();
```

UDP connection to remote address

```
var socket = new DirectSocket("udp", "52.43.121.77", 10001);
var abortable = new AbortController();
var encoder = new TextEncoder();
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
  console.log(decoder.decode(value.data));
  return reader.read().then(read);
}).catch((e) => e.message);

var writer = writable.getWriter();
await writer.write({
  data: encoder.encode(`So we need people to have weird new
ideas ... we need more ideas to break it
and make it better ...

Use it. Break it. File bugs. Request features.

- Soledad Penadés, Real time front-end alchemy, or: capturing, playing,
  altering and encoding video and audio streams, without
  servers or plugins!`)
});

promise
  .then((p) => {
    console.log(p);
  }).catch(console.warn);
```

UDP connection to local machine

```
var socket = new DirectSocket("udp", "0.0.0.0", 10001);
```

Close UDP connection

```
await writer.close();
```

## License
Do What the Fuck You Want to Public License [WTFPLv2](http://www.wtfpl.net/about/)
