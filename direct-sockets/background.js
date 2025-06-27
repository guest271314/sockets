globalThis.name = chrome.runtime.getManifest().short_name;
globalThis.port = null;
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo?.title === "TCPSocket" && globalThis.port === null) {
    console.log(changeInfo, tab, chrome.runtime.getManifest().host_permissions);
    globalThis.port = chrome.runtime.connectNative(globalThis.name);
    port.onMessage.addListener((message) => console.log(message));
    port.onDisconnect.addListener(() => console.log(chrome.runtime.lastError));
    const [{ id }] = await chrome.windows.getAll({
      populate: true,
      windowTypes: ["app"],
    });
    await chrome.windows.update(id, { focused: false });
  }
});

chrome.windows.onCreated.addListener(async ({ type, id }) => {
  const [{ title, url }] = await chrome.tabs.query({ windowId: id });
  console.log("Isolated App open", { type, id, title, url });
}, { windowTypes: ["app"] });

chrome.windows.onRemoved.addListener((id) => {
  console.log("Isolated App closed", id);
  globalThis?.port?.disconnect();
  globalThis.port = null;
}, { windowTypes: ["app"] });
