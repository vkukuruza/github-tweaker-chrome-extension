"use strict";

let branchColors;
let pullRequestDivs;
let urls = new Set();
let branchMap = new Map();
let modifiedTargetDivs = new Map();
let promises = [];

tweak();

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.message === "tweak") {
        tweak();
    }
});

function tweak() {
    let windowUrl = window.location.href;

    if (!windowUrl.includes('/pulls') || windowUrl.includes('github.com/pulls')) {
        return;
    }

    chrome.storage.local.get("branchColors", function (items) {
        let branchColorsJSON = Object.entries(JSON.parse(items.branchColors))
        branchColors = new Map(branchColorsJSON);

        collectData();
        retrieveBranchMap();
        populateDOM();
    });
}

function collectData() {
    collectPullRequestDIVs();

    for (let pullRequestDiv of pullRequestDivs) {
        collectURLs(pullRequestDiv);
        modifyTargetDIVS(pullRequestDiv);
    }
}

function collectPullRequestDIVs() {
    pullRequestDivs = document.getElementsByClassName(
        "Box-row Box-row--focus-gray p-0 mt-0 js-navigation-item js-issue-row"
    );
}

function collectURLs(pullRequestDiv) {
    let url = pullRequestDiv
        .getElementsByTagName("a")[0]
        .getAttribute("href");
    urls.add(url);
}

function modifyTargetDIVS(pullRequestDiv) {
    let pullRequestNumber = pullRequestDiv.getAttribute("id").split("_").pop();
    let targetDiv = pullRequestDiv.getElementsByClassName("d-flex mt-1 text-small color-fg-muted")[0];
    let newChildDiv = document.createElement("div");
    newChildDiv.setAttribute("style", "display: inline-block;");
    newChildDiv.innerHTML = targetDiv.innerHTML;
    newChildDiv.firstElementChild.setAttribute("style", "margin-right: 2px;");
    let newDivToInsert = createDivElement();
    newDivToInsert.appendChild(newChildDiv);
    modifiedTargetDivs.set(pullRequestNumber, newDivToInsert);
}

function createDivElement() {
    let divElement = document.createElement("div");
    divElement.setAttribute("class", "d-flex mt-1 text-small color-fg-muted");

    return divElement;
}

function retrieveBranchMap() {
    for (let url of urls) {
        if (!branchMap.has(url)) {
            promises.push(createHttpRequest("GET", url));
        }
    }
}

function createHttpRequest(method, url) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open(method, "https://github.com" + url);
        xhr.responseType = "document";
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
                let baseBranch = getBaseBranch(xhr.response);
                let comparingBranch = getComparingBranch(xhr.response);
                branchMap.set(url, baseBranch + ":" + comparingBranch);
            } else {
                reject({
                    status: xhr.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = function () {
            reject({
                status: xhr.status,
                statusText: xhr.statusText
            });
        };
        xhr.send();
    });
}

function getBaseBranch(data) {
    return data
        .getElementsByClassName("flex-auto min-width-0 mb-2")[0]
        .getElementsByClassName("css-truncate-target")[1].innerText;
}

function getComparingBranch(data) {
    return data
        .getElementsByClassName("flex-auto min-width-0 mb-2")[0]
        .getElementsByClassName("css-truncate-target")[
    data
        .getElementsByClassName("flex-auto min-width-0 mb-2")[0]
        .getElementsByClassName("css-truncate-target").length - 1
        ].innerText;
}

function populateDOM() {
    Promise.all(promises).then(function () {
        for (let url of urls) {
            let pullRequestNumber = url.split("/").pop();
            let pullRequestDiv = getPullRequestDiv(pullRequestNumber);
            let baseBranch = branchMap.get(url).split(":")[0];
            let comparingBranch = branchMap.get(url).split(":")[1];

            if (pullRequestDiv != null && notExistsSourceElement(pullRequestDiv)) {
                let divToReplace = getDivToReplace(pullRequestDiv);
                divToReplace.replaceWith(getModifiedTargetDiv(pullRequestNumber, baseBranch, comparingBranch));
            }
        }

        urls.clear();
    });
}

function getPullRequestDiv(pullRequestNumber) {
    return document.getElementById("issue_" + pullRequestNumber);
}

function notExistsSourceElement(pullRequestDiv) {
    return (
        pullRequestDiv
            .getElementsByClassName(
                "commit-ref css-truncate css-truncate-target user-select-contain base-r"
            ).length === 0
    );
}

function getDivToReplace(pullRequestDiv) {
    return pullRequestDiv
        .getElementsByClassName("flex-auto min-width-0 p-2 pr-3 pr-md-2")[0]
        .getElementsByClassName("d-flex mt-1 text-small color-fg-muted")[0];
}

function getModifiedTargetDiv(pullRequestNumber, baseBranch, comparingBranch) {
    let modifiedTargetDiv = modifiedTargetDivs.get(pullRequestNumber);
    modifiedTargetDiv.children[0].insertBefore(
        createMainBranchSpanElement(baseBranch, comparingBranch), modifiedTargetDiv.children[0].childNodes[2]
    );

    return modifiedTargetDiv;
}

function createMainBranchSpanElement(baseBranch, comparingBranch) {
    let outerBranchSpanElement = createOuterBranchSpanElement();
    outerBranchSpanElement.appendChild(createBranchSpanElement(baseBranch));
    outerBranchSpanElement.appendChild(createTextSpanElement("←"));
    outerBranchSpanElement.appendChild(createBranchSpanElement(comparingBranch));

    return outerBranchSpanElement;
}

function createOuterBranchSpanElement() {
    let spanElement = document.createElement("span");
    spanElement.setAttribute("style", "white-space:nowrap;");

    return spanElement;
}

function createBranchSpanElement(branchName) {
    let branchSpanElement = document.createElement("span");
    branchSpanElement.setAttribute(
        "class",
        "commit-ref css-truncate css-truncate-target user-select-contain base-r"
    );
    branchSpanElement.setAttribute("title", branchName);
    branchSpanElement.setAttribute("style", getBranchColorStyle(branchName));

    branchSpanElement.appendChild(document.createTextNode(branchName));

    return branchSpanElement;
}

function getBranchColorStyle(branchName) {
    let backgroundColor = branchColors.get(branchName)?.backgroundColor;
    let textColor = branchColors.get(branchName)?.textColor;
    let style = "";

    if (backgroundColor && textColor) {
        style += "background-color: " + backgroundColor + "; color: " + textColor + ";";
    }

    style += "max-width: 500px; font: 0.85em/1.7 ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace";
    return style;
}

function createTextSpanElement(innerText) {
    let textSpanElement = document.createElement("span");
    textSpanElement.setAttribute("class", "mx-1");
    textSpanElement.appendChild(document.createTextNode(innerText));

    return textSpanElement;
}
