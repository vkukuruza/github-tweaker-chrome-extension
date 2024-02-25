"use strict";

const COMMIT_LIST_IMAGE_PATH = "M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z";
const VALIDATION_LIST_IMAGE_PATH = "M2.5 1.75v11.5c0 .138.112.25.25.25h3.17a.75.75 0 0 1 0 1.5H2.75A1.75 1.75 0 0 1 1 13.25V1.75C1 .784 1.784 0 2.75 0h8.5C12.216 0 13 .784 13 1.75v7.736a.75.75 0 0 1-1.5 0V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13.274 9.537v-.001l-4.557 4.45a.75.75 0 0 1-1.055-.008l-1.943-1.95a.75.75 0 0 1 1.062-1.058l1.419 1.425 4.026-3.932a.75.75 0 1 1 1.048 1.074ZM4.75 4h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM4 7.75A.75.75 0 0 1 4.75 7h2a.75.75 0 0 1 0 1.5h-2A.75.75 0 0 1 4 7.75Z";
const SPINNER = '<style>.spinner_ajPY{transform-origin:center;animation:spinner_AtaB .75s infinite linear}@keyframes spinner_AtaB{100%{transform:rotate(360deg)}}</style><path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/><path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z" class="spinner_ajPY"/>';
const BUTTON_STYLE = "vertical-align:millde;padding:0 3px;font-size:10px;cursor: pointer; background-color: var(--timelineBadge-bgColor, var(--color-timeline-badge-bg))"
const TOP_BORDER_COLOR = "border-color:var(--borderColor-default, var(--color-border-default));"
const TOP_BORDER_STYLE = "padding:16px;border-style:solid;border-width:1px 0 0 0;" + TOP_BORDER_COLOR;
const ISSUE_PREFIX = "issue_";
const BUTTON = "button_"
const COMMIT_CONTENT_PREFIX = "commit_content_";
const VALIDATION_CONTENT_PREFIX = "validation_content_";
const COMMIT_BUTTON_PREFIX = COMMIT_CONTENT_PREFIX + BUTTON;
const VALIDATION_BUTTON_PREFIX = VALIDATION_CONTENT_PREFIX + BUTTON;
const DIV_ID = "id";
const ON = "_on";
const OFF = "_off";

let branchColors = new Map();
let progress = 0;
let progressDivs = [];
let pullRequestDivs;
let urls = new Set();
let baseUrl;
let branchMap = new Map();
let modifiedTargetDivs = new Map();
let promises = [];
let validationButtons = new Set();

let blockButtonAction = false;

tweak();

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.message === "tweak") {
        tweak();
    }
});

function tweak() {
    let windowUrl = window.location.href;

    if (!windowUrl.includes("/pulls") || windowUrl.includes("github.com/pulls")) {
        return;
    }
    baseUrl = windowUrl.substring(0, windowUrl.lastIndexOf("/"));

    chrome.storage.local.get("branchColors", function (items) {
        if (items.branchColors) {
            let branchColorsJSON = Object.entries(JSON.parse(items.branchColors))
            branchColors = new Map(branchColorsJSON);
        }

        insertProgressBar();
        collectData();
        retrieveBranchMap();
        populateDOM();
    });
}

function insertProgressBar() {
    progressDivs = [];
    let progressInnerDiv = document.getElementsByClassName("table-list-header-toggle states flex-auto pl-0");
    let progressDiv = document.createElement("progress");
    progressDiv.setAttribute(DIV_ID, "progressDiv");
    progressDiv.setAttribute("value", "0");
    progressDiv.setAttribute("style", "margin-left: 15px;vertical-align: middle;");
    progressDivs.push(progressDiv);
    progressDivs.push(progressDiv.cloneNode());
    progressInnerDiv[0].appendChild(progressDivs[0]);
    progressInnerDiv[1].appendChild(progressDivs[1]);
}

function collectData() {
    collectPullRequestDIVs();

    for (let pullRequestDiv of pullRequestDivs) {
        collectURLs(pullRequestDiv);
        modifyTargetDIVS(pullRequestDiv);
        reassignCommitButtonOnClickAction(pullRequestDiv);
        collectValidationButtons(pullRequestDiv);
    }

    populateProgressAttribute("max", urls.size);
}

function collectValidationButtons(pullRequestDiv) {
    let pullRequestStatus =
        pullRequestDiv.getElementsByClassName("tooltipped tooltipped-e")[0].getAttribute("aria-label");

    if (
        pullRequestStatus !== "Closed Pull Request" &&
        pullRequestDiv.getElementsByClassName("d-inline-block mr-1").length > 0
    ) {
        validationButtons.add(pullRequestDiv.getAttribute(DIV_ID).split("_").pop())
    }
}

function populateProgressAttribute(attributeName, value) {
    for (let progressDiv of progressDivs) {
        progressDiv.setAttribute(attributeName, value);
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
    let pullRequestNumber = pullRequestDiv.getAttribute(DIV_ID).split("_").pop();
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
        } else {
            progress++;
            populateProgressAttribute("value", progress);
        }
    }
}

function createHttpRequest(method, url) {
    return new Promise(function (resolve, reject) {
        makeRequest(method, "https://github.com" + url, function (err, xhr) {
            if (err) {
                throw err;
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
                let baseBranch = getBaseBranch(xhr.response);
                let comparingBranch = getComparingBranch(xhr.response);
                progress++;
                populateProgressAttribute("value", progress);
                branchMap.set(url, baseBranch + ":" + comparingBranch);
            } else {
                reject({
                    status: xhr.status,
                    statusText: xhr.statusText
                });
            }
        })
    });
}

function makeRequest(method, url, done) {
    let xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.responseType = "document";
    xhr.onload = function () {
        done(null, xhr);
    };
    xhr.onerror = function () {
        done(xhr);
        console.log(xhr.response);
    };
    xhr.send();
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
        progress = 0;
        populateProgressAttribute("style", "display:none;");
    });
}

function getPullRequestDiv(pullRequestNumber) {
    return document.getElementById(ISSUE_PREFIX + pullRequestNumber);
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
        createMainBranchSpanElement(baseBranch, comparingBranch, pullRequestNumber), modifiedTargetDiv.children[0].childNodes[2]
    );

    return modifiedTargetDiv;
}

function createMainBranchSpanElement(baseBranch, comparingBranch, pullRequestNumber) {
    let outerBranchSpanElement = createOuterBranchSpanElement();
    outerBranchSpanElement.appendChild(createBranchSpanElement(baseBranch));
    outerBranchSpanElement.appendChild(createTextSpanElement("←"));
    outerBranchSpanElement.appendChild(createBranchSpanElement(comparingBranch));
    outerBranchSpanElement.appendChild(createTextSpanElement("•"));
    outerBranchSpanElement.appendChild(
        createButton(
            "Commits",
            pullRequestNumber,
            COMMIT_BUTTON_PREFIX,
            COMMIT_LIST_IMAGE_PATH,
            function () {
                onClickCommitsButton(this);
            })
    );

    if (validationButtons.has(pullRequestNumber)) {
        outerBranchSpanElement.appendChild(createEmptySpanElement());
        outerBranchSpanElement.appendChild(
            outerBranchSpanElement.appendChild(
                createButton(
                    "Validations",
                    pullRequestNumber,
                    VALIDATION_BUTTON_PREFIX,
                    VALIDATION_LIST_IMAGE_PATH,
                    function () {
                        onClickValidationListButton(this);
                    })
            )
        );
    }

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

function createEmptySpanElement() {
    let emptySpanElement = document.createElement("span");
    emptySpanElement.setAttribute("style", "padding: 1px;");

    return emptySpanElement;
}

function reassignCommitButtonOnClickAction(pullRequestDiv) {
    let pullRequestNumber = pullRequestDiv.getAttribute(DIV_ID).split("_").pop();
    let existingCommitsButtonOff = document.getElementById(COMMIT_BUTTON_PREFIX + pullRequestNumber + OFF);
    let existingCommitButtonOn = document.getElementById(COMMIT_BUTTON_PREFIX + pullRequestNumber + ON);

    if (existingCommitsButtonOff) {
        existingCommitsButtonOff.onclick = function () {
            onClickCommitsButton(this);
        }
    } else if (existingCommitButtonOn) {
        existingCommitButtonOn.onclick = function () {
            onClickCommitsButton(this);
        }
    }

    let existingValidationButtonOff = document.getElementById(VALIDATION_BUTTON_PREFIX + pullRequestNumber + OFF);
    let existingValidationButtonOn = document.getElementById(VALIDATION_BUTTON_PREFIX + pullRequestNumber + ON);

    if (existingValidationButtonOff) {
        existingValidationButtonOff.onclick = function () {
            onClickValidationListButton(this);
        }
    } else if (existingValidationButtonOn) {
        existingValidationButtonOn.onclick = function () {
            onClickValidationListButton(this);
        }
    }
}

function createButton(branchName, pullRequestNumber, idPrefix, imagePath, onClickAction) {
    let button = document.createElement("div");
    let buttonId = idPrefix + pullRequestNumber + OFF;
    button.setAttribute(DIV_ID, buttonId);
    button.setAttribute("class", "commit-ref css-truncate css-truncate-target user-select-contain base-r");
    button.setAttribute("style", BUTTON_STYLE);
    button.setAttribute("title", branchName);
    button.appendChild(createImage(imagePath));
    button.dataset.url = baseUrl + "/pull/" + pullRequestNumber;
    button.onclick = onClickAction

    return button;
}

function createImage(imagePath) {
    let image = getImageElement();
    image.setAttribute("viewBox", "0 0 16 16");
    let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", imagePath);
    image.appendChild(path);

    return image;
}

function getSpinnerImage() {
    let image = getImageElement();
    image.setAttribute("viewBox", "0 0 24 24");
    image.innerHTML = SPINNER;

    return image;
}

function getImageElement() {
    let image = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    image.setAttribute("aria-hidden", "true");
    image.setAttribute("width", "12");
    image.setAttribute("height", "12");
    image.setAttribute("version", "1.1");
    image.setAttribute("data-view-component", "true");
    image.setAttribute("class", "octicon octicon-git-commit");

    return image;
}

function onClickCommitsButton(button) {
    let action = button.getAttribute(DIV_ID).split("_").pop();
    let pullRequestNumber = button.getAttribute(DIV_ID).split("_")[3];
    if (action === "off" && !isButtonBlocked()) {
        blockButton();
        turnOnSpinner(button);
        makeRequest("GET", button.dataset.url + "/commits", function (err, xhr) {
            if (err) {
                throw err;
            }
            let response = xhr.response;
            let commitsDiv = response.getElementsByClassName("js-navigation-container js-active-navigation-container")[0];
            commitsDiv.setAttribute(DIV_ID, COMMIT_CONTENT_PREFIX + pullRequestNumber);
            commitsDiv.setAttribute("style", TOP_BORDER_STYLE);
            let pullRequestDiv = document.getElementById(ISSUE_PREFIX + pullRequestNumber);
            pullRequestDiv.after(commitsDiv);
            button.setAttribute(DIV_ID, COMMIT_BUTTON_PREFIX + pullRequestNumber + ON);
            removeConcurrentContent(VALIDATION_CONTENT_PREFIX, pullRequestNumber);
            unblockButton();
            turnOffSpinner(button, COMMIT_LIST_IMAGE_PATH);
        });
    } else if (action === "on") {
        let commitsDiv = document.getElementById(COMMIT_CONTENT_PREFIX + pullRequestNumber);
        if (commitsDiv) {
            commitsDiv.remove();
        }
        button.setAttribute(DIV_ID, COMMIT_BUTTON_PREFIX + pullRequestNumber + OFF);
    }
}

function onClickValidationListButton(button) {
    let action = button.getAttribute(DIV_ID).split("_").pop();
    let pullRequestNumber = button.getAttribute(DIV_ID).split("_")[3];
    if (action === "off" && !isButtonBlocked()) {
        blockButton();
        turnOnSpinner(button);
        makeRequest("GET", button.dataset.url + "/partials/merging", function (err, xhr) {
            if (err) {
                throw err;
            }
            let buildDivs = xhr.response.getElementsByClassName("merge-status-item d-flex flex-items-baseline");
            if (buildDivs.length > 0) {
                mapBuildList(buildDivs, pullRequestNumber);
                removeConcurrentContent(COMMIT_CONTENT_PREFIX, pullRequestNumber);
                button.setAttribute(DIV_ID, VALIDATION_BUTTON_PREFIX + pullRequestNumber + ON);
                unblockButton();
                turnOffSpinner(button, VALIDATION_LIST_IMAGE_PATH);
            } else {
                makeRequest("GET", button.dataset.url, function (err, xhr) {
                    if (err) {
                        throw err;
                    }
                    let viewDetailsButton = xhr.response.getElementsByClassName("TimelineItem js-details-container Details")[0];
                    let eventId = viewDetailsButton.getAttribute(DIV_ID).split("-").pop();
                    makeRequest("GET", button.dataset.url + "/partials/commit_status_checks?event_id=" + eventId, function (err, xhr) {
                        if (err) {
                            throw err;
                        }
                        let buildList = xhr.response.getElementsByClassName("d-flex flex-items-baseline Box-row");
                        if (buildList && buildList.length > 0) {
                            mapBuildList(buildList, pullRequestNumber);
                            removeConcurrentContent(COMMIT_CONTENT_PREFIX, pullRequestNumber);
                        } else {
                            button.remove();
                        }
                        button.setAttribute(DIV_ID, VALIDATION_BUTTON_PREFIX + pullRequestNumber + ON);
                        unblockButton();
                        turnOffSpinner(button, VALIDATION_LIST_IMAGE_PATH);
                    });
                });
            }
        });
    } else if (action === "on") {
        let validationListDiv = document.getElementById(VALIDATION_CONTENT_PREFIX + pullRequestNumber);
        if (validationListDiv) {
            validationListDiv.remove();
        }
        button.setAttribute(DIV_ID, VALIDATION_BUTTON_PREFIX + pullRequestNumber + OFF);
    }
}

function mapBuildList(buildList, pullRequestNumber) {
    if (!buildList || buildList.length < 1) {
        return;
    }
    let buildListDiv = document.createElement("div");
    buildListDiv.setAttribute("style", TOP_BORDER_STYLE);
    buildListDiv.setAttribute(DIV_ID, VALIDATION_CONTENT_PREFIX + pullRequestNumber);
    let borderDiv = document.createElement("div");
    borderDiv.setAttribute("style", "border-style:solid;border-width:1px;border-radius:6px;" + TOP_BORDER_COLOR);
    buildListDiv.appendChild(borderDiv);

    Array.from(buildList).forEach(function (element) {
        let hrefs = element.getElementsByTagName("a");

        if (hrefs && hrefs.length > 0) {
            Array.from(hrefs).forEach(function (a) {
                a.setAttribute("target", "_blank");
            });
        }

        element.setAttribute("style", "padding:8px 8px;background-color:transparent;");
        borderDiv.appendChild(element);
    });

    let pullRequestDiv = document.getElementById(ISSUE_PREFIX + pullRequestNumber);
    pullRequestDiv.after(buildListDiv);
}

function removeConcurrentContent(idPrefix, pullRequestNumber) {
    let contentDiv = document.getElementById(idPrefix + pullRequestNumber);
    if (contentDiv) {
        contentDiv.remove();
        let button = document.getElementById(idPrefix + BUTTON + pullRequestNumber + ON);
        if (button) {
            button.setAttribute(DIV_ID, idPrefix + BUTTON + pullRequestNumber + OFF);
        }
    }
}

function turnOnSpinner(element) {
    let image = element.getElementsByTagName("svg")[0];
    image.replaceWith(getSpinnerImage());
}

function turnOffSpinner(element, imagePath) {
    let image = element.getElementsByTagName("svg")[0];
    image.replaceWith(createImage(imagePath));
}

function isButtonBlocked() {
    return blockButtonAction;
}

function blockButton() {
    blockButtonAction = true;
}

function unblockButton() {
    blockButtonAction = false;
}