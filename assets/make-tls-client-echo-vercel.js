// https://github.com/explainers-by-googlers/verifyTLSServerCertificateForIWA?tab=readme-ov-file#example-with-direct-sockets-and-tls
// https://github.com/guest271314/tls/blob/main/make-client-tls-bundle.js
var {
  makeTLSClient
} = await import("./make-tls-client-bundle.js");
var decoder = new TextDecoder();
var encoder = new TextEncoder();
var host = "echo-one-lac.vercel.app";
var port = 443;
var socket = new TCPSocket(host, port);
socket.closed.then(() =>
  console.log(`Connection to ${remoteAddress}:${remotePort} closed`)
);
var {
  readable,
  writable,
  remoteAddress,
  remotePort
} = await socket.opened;
console.log(`Connection to ${remoteAddress}:${remotePort} opened`);
// https://codereview.stackexchange.com/a/297492/47730
function splitHeadersAndBody(raw) {
  console.log(raw);
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
var writer = writable.getWriter();
var abortable = new AbortController();
var data = `One interesting note on this. Historically, I think the most widely used programming 
linkages have come not from the programming language research committee, but rather 
from people who build systems and wanted a language to help themselves.

- A brief interview with Tcl creator John Ousterhout`;
var tlsClient = makeTLSClient({
  host,
  verifyServerCertificate: !1,
  cipherSuites: void 0,
  supportedProtocolVersions: ["TLS1_2", "TLS1_3"],
  async write({
    header,
    content
  }) {
    await writer.write(header);
    await writer.write(content);
  },
  onHandshake() {
    tlsClient.write(
      encoder.encode(
        `POST /api/server HTTP/1.1\r\n\Host:${host}\r\nContent-Length:${data.length}\r\n\r\n${data}`,
      ),
    );
  },
  onApplicationData(data) {
    var response = decoder.decode(data);
    if (/^HTTP/.test(response)) {

    }
    if (!/^(HTTP|0[\r\n]+$)/i.test(response)) {
      console.log(response.trim().split(/\r\n/).pop());
    }
    if (/^0[\r\n]+$/.test(response)) {
      abortable.abort("");
      writer.abort().then(() => socket.close());
    }
  },
  onTlsEnd(error) {
    console.info(error);
  },
});

tlsClient.startHandshake();
await readable
  .pipeTo(
    new WritableStream({
      write(value) {
        tlsClient.handleReceivedBytes(value);
      },
    }), {
      signal: abortable.signal
    },
  ).catch(() => {});