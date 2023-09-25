"use strict";

let hrefs = [];
let issues;
let referenceNodesToModify = new Map();

function tweak() {
  collectData();

  for (let i = 0; i < hrefs.length; i++) {
    makeRequest("GET", "https://github.com" + hrefs[i], function (err, data) {
      if (err) {
        throw err;
      }

      let baseBranch = getBaseBranch(data);
      let comparingBranch = getComparingBranch(data);
      let issueNumber = getIssueNumber(data);
      let issueDiv = getIssueDiv(issueNumber);

      if (issueDiv != null && notExistsSourceElement(issueDiv)) {
        let referenceNode = getReferenceNode(issueDiv);
        referenceNode.replaceWith(getNewElement(issueNumber, baseBranch, comparingBranch));
      }
    });
  }
}

function collectData() {
  getIssues();

  for (var i = 0; i < issues.length; i++) {
    collectHrefs(i);
    collectReferenceNodesToModify(i);
  }
}

function getIssues() {
  issues =
      document.getElementsByClassName(
          "Box-row Box-row--focus-gray p-0 mt-0 js-navigation-item js-issue-row"
      );
}

function collectHrefs(i) {
  let href = issues[i]
      .getElementsByClassName("flex-auto min-width-0 p-2 pr-3 pr-md-2")[0]
      .getElementsByTagName("a")[0]
      .getAttribute("href");
  hrefs.push(href);
}

function collectReferenceNodesToModify(i) {
  let issueNumber = issues[i].getAttribute("id").split("_").pop();
  let innerHtml=
      issues[i]
          .getElementsByClassName("flex-shrink-0 col-4 col-md-3 pt-2 text-right pr-3 no-wrap d-flex hide-sm")[0]
          .innerHTML;
  let newDiv = document.createElement("div");
  newDiv.setAttribute("class", "flex-shrink-0 pt-2 text-right pr-3 no-wrap d-flex");
  newDiv.innerHTML = innerHtml;
  let mainDiv = document.createElement("div");
  mainDiv.setAttribute("class", "col-4 col-md-3 hide-sm");
  mainDiv.appendChild(newDiv);


  // console.log(mainDiv);
  referenceNodesToModify.set(issueNumber, mainDiv);
}

function makeRequest(method, url, done) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, url);
  xhr.responseType = "document";
  xhr.onload = function () {
    done(null, xhr.response);
  };
  xhr.onerror = function () {
    done(xhr.response);
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

function getIssueNumber(data) {
  return data
    .getElementsByClassName("flex-auto min-width-0 mb-2")[0]
    .baseURI.split("/")
    .pop();
}

function getIssueDiv(issueNumber) {
  return document.getElementById("issue_" + issueNumber);
}

function notExistsSourceElement(issueDiv) {
  return (
    issueDiv
      .getElementsByClassName("col-4 col-md-3 hide-sm")[0]
      .getElementsByClassName(
        "lh-condensed-ultra color-fg-muted mt-1 mr-3 d-flex flex-items-center"
      ).length === 0
  );
}

function getReferenceNode(issueDiv) {
  return issueDiv
    .getElementsByClassName("flex-shrink-0 col-4 col-md-3 pt-2 text-right pr-3 no-wrap d-flex hide-sm")[0]
    // .getElementsByClassName("d-flex mt-1 text-small color-fg-muted")[0]
      ;
}

function getNewElement(issueNumber, baseBranch, comparingBranch) {
  let newElement = referenceNodesToModify.get(issueNumber);
  let referenceNode=
      newElement.getElementsByClassName("flex-shrink-0 pt-2 text-right pr-3 no-wrap d-flex");
  newElement.appendChild(createSourceElement(baseBranch, comparingBranch));

  return newElement;
}

function createSourceElement(baseBranch, comparingBranch) {
  let sourceElement = createDivElement();
  sourceElement.appendChild(createSourceSpanElement(comparingBranch));
  sourceElement.appendChild(createArrowSpanElement("→"));
  sourceElement.appendChild(createSourceSpanElement(baseBranch));

  return sourceElement;
}

function createDivElement() {
  let divElement = document.createElement("div");
  divElement.setAttribute(
    "class",
    "lh-condensed-ultra color-fg-muted mt-1 mr-3 d-flex flex-items-center"
  );
  divElement.setAttribute("style", 'float: right; padding-top: 4px;');

  return divElement;
}

function createSourceSpanElement(innerText) {
  let spanElement = document.createElement("span");
  spanElement.setAttribute(
    "class",
    "commit-ref css-truncate css-truncate-target user-select-contain base-r"
  );
  spanElement.setAttribute("title", innerText);
  spanElement.setAttribute("style", "max-width: 500px");
  spanElement.appendChild(document.createTextNode(innerText));

  return spanElement;
}

function createArrowSpanElement(innerText) {
  let spanElement = document.createElement("span");
  spanElement.setAttribute("class", "mx-1");
  spanElement.appendChild(document.createTextNode(innerText));

  return spanElement;
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.message === "tweak") {
    console.log('tweak')
    tweak();
  }
});
