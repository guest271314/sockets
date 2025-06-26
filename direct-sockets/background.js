globalThis.name = chrome.runtime.getManifest().short_name;
globalThis.port;
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.title === "TCPSocket") {
    console.log(tab);
    const[{ id }] = await chrome.windows.getAll({
      populate: true,
      windowTypes: ["app"],
    });
    await chrome.windows.update(id, {focused: false});
    globalThis.port = chrome.runtime.connectNative(globalThis.name);
    port.onMessage.addListener((message) => console.log(message));
    port.onDisconnect.addListener(() => console.log(chrome.runtime.lastError));
  }
});

chrome.windows.onCreated.addListener(async ({ type, id }) => {
  const [{title, url}] = await chrome.tabs.query({windowId:id});
  console.log("Isolated App open", { type, id, title, url });
}, { windowTypes: ["app"] });

chrome.windows.onRemoved.addListener((id) => {
  console.log("Isolated App closed", id);
  globalThis?.port?.disconnect();
}, { windowTypes: ["app"] });