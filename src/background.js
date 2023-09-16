"use strict";

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  // this event fires multiple times (known bug), used notExistsSourceElement() method as workaround
  if (changeInfo.status === "complete") {
    chrome.tabs.sendMessage(tabId, {
      message: "tweak",
      tabId: tabId,
      changeInfo: changeInfo.url,
      tab: tab.url,
    });
  }
});
