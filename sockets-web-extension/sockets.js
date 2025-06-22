#!/usr/bin/env /home/user/bin/node

import { Server } from "node:net";
import { Duplex } from "node:stream";
import { createSocket } from "node:dgram";

const abortable = new AbortController();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const {
  signal,
} = abortable;

const udpserver = createSocket("udp4");

udpserver.on("message", (msg, rinfo) => {
  udpserver.send(msg, rinfo.port, rinfo.address, (err) => {
    if (err) {
      udpserver.close();
    }
  });
});

udpserver.on("listening", () => {});

udpserver.on("error", (err) => {
  server.close();
});

udpserver.on("close", () => {});

udpserver.bind(10001);

const connectionListener = async (socket) => {
  const { readable, writable } = Duplex.toWeb(socket);
  const writer = writable.getWriter();
  await readable.pipeThrough(new TextDecoderStream(), {
    signal,
  }).pipeTo(
    new WritableStream({
      async write(value, controller) {
        await writer.write(value);
      },
      close() {
      },
      abort(reason) {
      },
    }),
  ).catch(() => {
  });
};

const tcpserver = new Server({
  highWaterMark: 0,
  noDelay: true,
}, connectionListener);

tcpserver.listen({
  port: 8080,
  host: "127.0.0.1",
  signal,
});

await import("./nm_host.js");
