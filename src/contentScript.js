"use strict";

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.message === "tweak") {
    tweak();
  }
});

function tweak() {
  var issues = getIssues();
  var hrefs = getHrefs(issues);

  for (var i = 0; i < hrefs.length; i++) {
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
        referenceNode.before(createSourceElement(baseBranch, comparingBranch));
      }
    });
  }
}

function getIssues() {
  return document.getElementsByClassName(
    "Box-row Box-row--focus-gray p-0 mt-0 js-navigation-item js-issue-row"
  );
}

function getHrefs(issues) {
  var hrefs = [];

  for (var i = 0; i < issues.length; i++) {
    let href = issues[i]
      .getElementsByClassName("flex-auto min-width-0 p-2 pr-3 pr-md-2")[0]
      .getElementsByTagName("a")[0]
      .getAttribute("href");

    hrefs.push(href);
  }

  return hrefs;
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
      .getElementsByClassName("flex-auto min-width-0 p-2 pr-3 pr-md-2")[0]
      .getElementsByClassName(
        "lh-condensed-ultra color-fg-muted mt-1 mr-3 d-flex flex-items-center"
      ).length === 0
  );
}

function getReferenceNode(issueDiv) {
  return issueDiv
    .getElementsByClassName("flex-auto min-width-0 p-2 pr-3 pr-md-2")[0]
    .getElementsByClassName("d-flex mt-1 text-small color-fg-muted")[0];
}

function createSourceElement(baseBranch, comparingBranch) {
  let sourceElement = createDivElement();
  sourceElement.appendChild(createSourceSpanElement(baseBranch));
  sourceElement.appendChild(createArrowSpanElement("←"));
  sourceElement.appendChild(createSourceSpanElement(comparingBranch));

  return sourceElement;
}

function createDivElement() {
  let divElement = document.createElement("div");
  divElement.setAttribute(
    "class",
    "lh-condensed-ultra color-fg-muted mt-1 mr-3 d-flex flex-items-center"
  );

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
