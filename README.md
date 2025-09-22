# sockets
TCP and UDP sockets in the browser using Web extension API's and Direct Sockets from an [Isolated Web App](https://github.com/WICG/isolated-web-apps/blob/main/README.md) (IWA).

# Branch `fetch-webrtc` 

Branch `fetch-webrtc` continues development of [telnet-client](https://github.com/guest271314/telnet-client) which is a fork of [GoogleChromeLabs/telnet-client](https://github.com/GoogleChromeLabs/telnet-client).

`window.open("isolated-app://")` capability was blocked by iwa: [Mark isolated-app: as being handled by Chrome](https://chromium-review.googlesource.com/c/chromium/src/+/5466063). 

[Query string parameters in isolated-app: URL disappear](https://issues.chromium.org/issues/426833112?pli=1) is marked as `
Won't fix (Intended behavior)`. SDP is passed to a Web extension using query string parameters. That used to be possible with this alone

```
const window = await chrome.windows.create({
  url: `${url}${detail}`,
  height: 0,
  width: 0,
  left: 0,
  top: 0,
  focused: false,
  type: "normal",
});
```

where `detail` is `?sdp=...`. That approach is still possible by updating the URL after initial load

```
const tab = await chrome.tabs.update(window.tabs[0].id, {
  url: `${url}${detail}`,
});
```

Herein we use `TCPServerSocket` in the IWA and WHATWG `fetch()` in the arbitrary user determinined `window` to exchange WebRTC signals.

TODO: 

- Re-write Deno and Node.js TCP servers, include UDP server 
- Full-duplex stream using WHATWG `fetch()` piped through `TCPSocket` and `UDPSocket`
- Create Signed Web Bundle and Isolated Web App in the browser

## Install dependencies

```
npm install
```

or

```
bun install
```

or use Deno for network imports and source code caching, and generating cryptographic keys for IWA

```
deno -A -c deno.json generateWebCryptoKeys.js
```

## Generate cryptographic keys for IWA


```
bun generateWebCryptoKeys.js
```

or

```
node generateWebCryptoKeys.js
```

## Write Signed Web Bundle


```
deno -A -c deno.json index.js
```

or 
```
node index.js
```
or

```
bun index.js
```

## Install dependencies and write Signed Web Bundle

```
import { $ } from "bun";
await $.cwd(`/home/user/sockets-fetch-webrtc`);
const pwd = await $`pwd`.text();
await $`echo Working in ${pwd}`;
await $`bun index.js`;
const p = "/home/user/chrome-linux/chrome --no-startup-window "
+ "--password-store=basic --install-isolated-web-app-from-file="
+ "/home/user/sockets-fetch-webrtc/signed.swbn";
await $`bash -c "${p}"`;
process.exit();
```

## Load the Signed Web Bundle 

On command line

```
~/chrome-linux/chrome --no-startup-window \
--password-store=basic \
--install-isolated-web-app-from-file=/home/user/sockets/signed.swbn
```

or select the `signed.swbn` file in `chrome://web-app-internals`.

## Installation of browser extension and Native Messaging host on Chrome and Chromium

1. Navigate to `chrome://extensions`.
2. Toggle `Developer mode`.
3. Click `Load unpacked`.
4. Select `direct-sockets` folder.
5. Note the generated extension ID.
6. Open `nm_tcpsocket.json` in a text editor, set `"path"` to absolute path of [txiki.js](https://github.com/saghul/txiki.js) `txikijs_echo_tcp.js` or [Bun](https://github.com/oven-sh/bun) `bun_echo_tcp.js` TCP servers, and set `"allowed_origins"` array value to `chrome-extension://<ID>/` using ID from 5 . 
7. Copy the `nm_tcpsocket.json` file to Chrome or Chromium configuration folder, e.g., on Chromium on Linux `~/.config/chromium/NativeMessagingHosts`.
8. Make sure the TCP echo server `*.js` file is executable.

Or, programmatically when launching `chrome --load-extension=/home/user/sockets/direct-sockets`.

Load the unpacked Web extension [Isolated Web App Utilities](https://github.com/guest271314/isolated-web-app-utilities) to open the IWA window.

## Usage

To avoid mixed-content UI warning launch with 

```
chrome --unsafely-treat-insecure-origin-as-secure=http://0.0.0.0:44819
```

To avoid Chromium rendering insecure connection notification in the address bar, and to disable this https://github.com/WICG/local-network-access (which blocks `WebSocket` requests to `localhost` 
on Chromium Version 142.0.7401.0 (Developer Build) (64-bit)).

```
--disable-features=LocalNetworkAccessChecks,LocalWebApprovals,LocalNetworkAccessChecksWebSockets
```




In an arbitrary window, for example, in `console` and Snippets in DevTools, or script imported, or script injected by Web extension, execute the script `direct-socket-controller-streams.js` in the `direct-sockets` Web extension forlder, which communicates with IWA to local or remote `TCPSocket` or `UDPSocket` and back to back to Web page with WebRTC 

### Send 20 MB to local UDP server, read 20 MB echoed back
```
var socket = new DirectSockets({
  protocol: "udp",
  address: "127.0.0.1",
  port: 8000,
});

socket.closed.then(() =>
  console.log("socket closed resolve", socket.options.readyState)
).catch((e) =>
  console.log("socket closed reject", e, socket.options.readyState)
);
// Early close
// socket.close();
var decoder = new TextDecoder();
var p = await socket.opened.catch((e) => {
  console.log("socket opened reject", e);
});
if (p?.readable) {
  var {
    readable,
    writable
  } = p;
  var reader = readable.getReader();
  var writer = writable.getWriter();
  async function stream(input) {
    var len = 0;
    for (let i = 0; i < input.length; i += socket.options.maxMessageSize) {
      const data = input.subarray(i, i + socket.options.maxMessageSize);
      await writer.ready;
      await writer.write(data).catch((e) => {
        throw e;
      });
      await socket.bufferedAmountLow();
      let readLength = 0;
      do {
        var {
          value,
          done
        } = await reader.read();
        len += value.byteLength, done;
        readLength += value.byteLength;
      } while (readLength < data.length);
    }
    await Promise.all([writer.close(), writer.closed]);
    return len;
  }
  var result = await stream(new Uint8Array(1024 ** 2 * 20)).catch((e) => e);

  console.log(result);
  reader.releaseLock();
  writer.releaseLock();
}
```

### Send message to tcpbin.com, read message echoed back over TCP

```
var socket = new DirectSockets({
  protocol: "tcp",
  address: "tcpbin.com",
  port: 4242,
});
async function stream(input) {
  let result2 = "";
  await writer.ready;
  await writer.write(input);
  await socket.bufferedAmountLow();
  await scheduler.postTask(() => Promise.all([writer.close(), writer.closed]), {
    delay: 300
  }, );
  return reader.read().then(async function read({
    value,
    done
  }) {
    if (done) {
      return result2;
    }
    result2 += decoder.decode(value);
    return reader.read().then(read);
  });
}
var result = await stream(encoder.encode(`So we need people to have weird new
ideas ... we need more ideas to break it
and make it better ...

Use it. Break it. File bugs. Request features.

- Soledad Penadés, Real time front-end alchemy, or: capturing, playing,
  altering and encoding video and audio streams, without
  servers or plugins!
`, )).catch((e) => e);

console.log(result);
reader.releaseLock();
writer.releaseLock();
```

### Make HTTP request over TCP to github.com, read raw HTTP headers and HTML response

```
var socket = new DirectSockets({
  protocol: "tcp",
  address: "guest271314.github.io",
  port: 80,
});

var result = await stream(
  encoder
  .encode("GET / HTTP/1.1\r\n\Host:guest271314.github.io\r\n\r\n")
).catch( (e) => e);

console.log(result);
reader.releaseLock();
writer.releaseLock();
```

### Send message to remote UDP address, read message back

```
var socket = new DirectSockets({
  protocol: "udp",
  address: "52.43.121.77",
  port: 10001,
});

var result = await stream(encoder.encode(`von Braun believed in testing. I cannot
emphasize that term enough – test, test,
test. Test to the point it breaks.

- Ed Buckbee, NASA Public Affairs Officer, Chasing the Moon`)).catch( (e) => e);

console.log(result);
reader.releaseLock();
writer.releaseLock();
```

### Close socket early, handle rejected Promises

```
var socket = new DirectSockets({
  protocol: "udp",
  address: "52.43.121.77",
  port: 10001,
});
console.log(socket);
socket.closed.then( (args) => console.log("socket closed", args, socket.options.readyState)).catch( (e) => console.log("socket closed reject", e, socket.options.readyState));
// Early close
socket.close(); // returns undefined
// ...
var p = await socket.opened.catch( (e) => {
  console.log("socket opened reject", e);
}
);
console.log(p);
```
### Close socket later
```
{
  // ...
  var result = await stream(await new Response(_readable).bytes()).catch((e) => e);

  console.log(result);
  reader.releaseLock();
  writer.releaseLock();
}
socket.close();
```

## License
Do What the Fuck You Want to Public License [WTFPLv2](http://www.wtfpl.net/about/)
