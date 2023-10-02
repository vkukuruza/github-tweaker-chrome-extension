"use strict";

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
        if (
            changeInfo.url &&
            changeInfo.url.includes("/pulls") &&
            !changeInfo.url.includes("github.com/pulls")
        ) {
            console.log(changeInfo.url);
            chrome.tabs.sendMessage(tabId, {
                message: "tweak"
            });
        }
    }
);
