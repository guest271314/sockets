// https://github.com/explainers-by-googlers/verifyTLSServerCertificateForIWA?tab=readme-ov-file#example-with-direct-sockets-and-tls
// https://github.com/guest271314/tls/blob/main/make-client-tls-bundle.js
var { makeTLSClient } = await import("./make-tls-client-bundle.js");
var decoder = new TextDecoder();
var encoder = new TextEncoder();
var host = "clean-gnu-28.deno.dev";
var port = 443;
var socket = new TCPSocket(host, port);
socket.closed.then(() =>
  console.log(`Connection to ${remoteAddress}:${remotePort} closed`)
);
var { readable, writable, remoteAddress, remotePort } = await socket.opened;
console.log(`Connection to ${remoteAddress}:${remotePort} opened`);
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
var writer = writable.getWriter();
var abortable = new AbortController();
var data = "Test, test, test. Test to the point it breaks";
var tlsClient = makeTLSClient({
  host,
  verifyServerCertificate: !1,
  cipherSuites: [
    "TLS_AES_128_GCM_SHA256",
    "TLS_CHACHA20_POLY1305_SHA256",
    "TLS_AES_256_GCM_SHA384",
    "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
  ],
  supportedProtocolVersions: ["TLS1_2", "TLS1_3"],
  async write({ header, content }) {
    await writer.write(header);
    await writer.write(content);
  },
  onHandshake() {
    tlsClient.write(
      encoder.encode(
        `POST / HTTP/1.1\r\n\Host:${host}\r\nContent-Length:${data.length}\r\n\r\n${data}`,
      ),
    );
  },
  onApplicationData(data) {
    var [headers, body] = splitHeadersAndBody(data);
    console.log(decoder.decode(body));
    abortable.abort("");
    writer.close().then(() => socket.close());
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
    }),
    { signal: abortable.signal },
  ).catch(() => {});
