"use strict";

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
        if (changeInfo.title && changeInfo.title.includes("Pull requests · ")) {
            chrome.tabs.sendMessage(tabId, {
                message: "tweak"
            });
        }
    }
);
