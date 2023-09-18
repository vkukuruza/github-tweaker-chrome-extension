"use strict";

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  // this event fires multiple times (known bug), used notExistsSourceElement() method as workaround
  if (changeInfo.status === "complete" && tab.title.startsWith('Pull requests · ')) {
    chrome.tabs.sendMessage(tabId, {
      message: "tweak"
    });
  }
});
