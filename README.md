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

In an arbitrary window, for example, in `console` and Snippets in DevTools, or script imported, or script injected by Web extension, execute the script `direct-socket-controller.js` in the `direct-sockets` Web extension forlder, which communicates with IWA to local (or remote) `TCPSocket` back to Web page with WebRTC 

```
var decoder = new TextDecoder();
var local = new RTCPeerConnection({
  sdpSemantics: "unified-plan",
});
[
  "onsignalingstatechange",
  "oniceconnectionstatechange",
  "onicegatheringstatechange",
].forEach((e) => local.addEventListener(e, console.log));

local.onicecandidate = async (e) => {
  if (!e.candidate) {
    try {
      if (globalThis?.openIsolatedWebApp) {
        await openIsolatedWebApp(`?name=TCPSocket`);
      } else {
        setTitle(`?=TCPSocket`);
      }
      await scheduler.postTask(() => {}, {
        delay: 3000,
        priority: "user-visible",
      });
      console.log("sdp:", local.localDescription);
      var abortable = new AbortController();
      var {
        signal
      } = abortable;
      var sdp = await (await fetch("http://0.0.0.0:44819", {
        method: "post",
        body: new TextEncoder().encode(local.localDescription.sdp),
        signal,
      })).text();
      await local.setRemoteDescription({
        type: "answer",
        sdp,
      });
      console.log("Done signaling SDP");
    } catch (e) {
      console.error(e);
    }
  }
};
var channel = local.createDataChannel("transfer", {
  negotiated: true,
  ordered: true,
  id: 0,
  binaryType: "arraybuffer",
  protocol: "udp",
});

var readableController;
var writableController;

var {
  resolve,
  promise: dataChannelStream
} = Promise.withResolvers();
// var writer = writable.getWriter();

channel.onopen = async (e) => {

  console.log(e.type, e.target);

  var readable = new ReadableStream({
    start(_) {
      return readableController = _;
    },
    cancel(reason) {
      console.log(reason);
    },
  });

  var writable = new WritableStream({
    start(_) {
      return writableController = _;
    },
    write(v) {
      console.log(v);
      console.log(channel.bufferedAmount);
      channel.send(v);
      channel.bufferedAmountLowThreshold = channel.bufferedAmount - 1;
      console.log(channel.bufferedAmount);
    },
    close() {
      console.log("writable close");
      channel.close();
    },
    abort(reason) {
      console.log(reason);
    },
  });

  readable.pipeTo(new WritableStream({
    write(v) {
      console.log(decoder.decode(v));
    },
  }), ).catch(() => channel.close());

  resolve({
    readable,
    writable
  });
};

channel.onclose = async (e) => {
  console.log(e.type, e.target);
  await Promise.allSettled([readable.cancel(), writable.close()])
   .then(() => console.log("streams closed")).catch(console.log);
};

channel.onclosing = async (e) => {
  console.log(e.type);
};

channel.onbufferedamountlow = (e) => {
  console.log(e.type, channel.bufferedAmount);
};

channel.onerror = async (e) => {
  console.log(e.type, e.target);
  await Promise.allSettled([readable.cancel(), writable.close()])
    .then(() => console.log("streams closed")).catch(console.log);
};

channel.onmessage = (e) => {
  readableController.enqueue(e.data);
};

var offer = await local.createOffer({
  voiceActivityDetection: false,
});

local.setLocalDescription(offer);

var {
  readable,
  writable
} = await dataChannelStream;

await scheduler.postTask(() => {}, {
  delay: 500,
  priority: "background",
});

await new Response(`von Braun believed in testing. I cannot
emphasize that term enough – test, test,
test. Test to the point it breaks.

- Ed Buckbee, NASA Public Affairs Officer, Chasing the Moon`).body.pipeTo(writable, {
  preventClose: 1
});

// Close the connection
await writable.close();
```

## License
Do What the Fuck You Want to Public License [WTFPLv2](http://www.wtfpl.net/about/)
