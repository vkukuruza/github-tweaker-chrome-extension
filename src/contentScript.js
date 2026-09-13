"use strict";

const COMMIT_LIST_IMAGE_PATH = "M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z";
const CHECK_ICON_PATH = "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z";
const COPY_SHA_BUTTON_CLASS = "ght-copy-sha-button";
const SPINNER = '<style>.spinner_ajPY{transform-origin:center;animation:spinner_AtaB .75s infinite linear}@keyframes spinner_AtaB{100%{transform:rotate(360deg)}}</style><path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/><path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z" class="spinner_ajPY"/>';
const BUTTON_STYLE = "vertical-align:middle;position:relative;top:-1px;padding:0 3px;font-size:10px;cursor: pointer; background-color: var(--control-transparent-bgColor-hover, var(--color-action-list-item-default-hover-bg))"
const TOP_BORDER_COLOR = "border-color:var(--borderColor-default, var(--color-border-default));"
const TOP_BORDER_STYLE = "padding:8px 16px 12px 9px;border-style:solid;border-width:0 0 1px 0;" + TOP_BORDER_COLOR;
const ISSUE_PREFIX = "issue_";
const BUTTON = "button_"
const COMMIT_CONTENT_PREFIX = "commit_content_";
const COMMIT_CONTENT_CLASS = "ght-commits-content";
const COMMIT_BUTTON_PREFIX = COMMIT_CONTENT_PREFIX + BUTTON;
const DIV_ID = "id";
const ON = "_on";
const OFF = "_off";
// Selector for a PR row in GitHub's newer React-based Pull Requests list UI
// (CSS Modules class names get a random hash suffix, hence the `*=` match).
const NEW_UI_ROW_SELECTOR = 'li[class*="PullsListItem-module__listItem"]';
// Marker class for the base/head branch names inside GitHub's own PR hovercard
// (the popup that appears when hovering a PR title link). Distinguishes them from
// our own branch pills in the PR list, which need a different (non-truncating)
// style computation - see computeBranchElementStyle().
const HOVERCARD_BRANCH_CLASS = "ght-hovercard-branch-ref";
// Marker class for the base/head branch names inside an individual PR page's own
// header ("<user> merged/wants to merge ... into <base> from <head>").
const PR_HEADER_BRANCH_CLASS = "ght-pr-header-branch-ref";
// CSS Modules class names get a random hash suffix, hence the `*=` match.
const PR_HEADER_BRANCHES_CONTAINER_SELECTOR = 'div[class*="PullRequestHeaderBranches-module__branches"]';
// Marker class for branch names inside a PR's own conversation timeline (e.g. a
// "merged commit X into <base>" or force-push event), rendered with GitHub's
// classic (pre-React) markup: an outer ".commit-ref" span wrapping a
// ".base-ref"/".head-ref" span, which itself wraps the actual
// ".css-truncate-target" text span.
const PR_TIMELINE_BRANCH_CLASS = "ght-pr-timeline-branch-ref";

let branchColors = new Map();
let progress = 0;
let pullRequestDivs;
let urls = new Set();
let baseUrl;
// The aggregate "https://github.com/pulls" dashboard lists PRs from many
// different repos side by side, unlike a single repo's own "/pulls" page - so a
// single global `baseUrl` (derived once from the current page's own URL) isn't
// enough to build a correct ".../pull/<number>" link for the Commits button.
// Track each PR's own repo base URL (e.g. "https://github.com/owner/repo")
// individually instead, keyed by PR number - see collectURLs().
let pullRequestBaseUrls = new Map();
let branchMap = new Map();
let modifiedTargetDivs = new Map();
let promises = [];

// PR numbers with a Commits fetch currently in flight. Blocking is per-PR (not
// global) so opening one PR's commit list doesn't prevent opening another's while
// the first is still loading.
let blockedPullRequestNumbers = new Set();

tweak();

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.message === "tweak") {
        tweak();
    }
});

let lastTweakedUrl = window.location.href;

function tweakIfUrlChanged() {
    if (window.location.href !== lastTweakedUrl) {
        lastTweakedUrl = window.location.href;
        // Any expanded "Commits" content belongs to PRs from the section/tab we're
        // navigating away from (e.g. Open -> Closed). GitHub's client-side routing
        // reuses/reorders the underlying list DOM instead of a full page reload, so
        // these previously-inserted elements (siblings of a PR row, not tracked by
        // React) don't get cleaned up on their own and end up sitting in whatever
        // unrelated spot the DOM churn leaves them in. Clear them out on every real
        // navigation instead.
        removeAllCommitsContent();
        tweak();
    }
}

function removeAllCommitsContent() {
    document.querySelectorAll("." + COMMIT_CONTENT_CLASS).forEach(function (commitsDiv) {
        commitsDiv.remove();
    });
}

// GitHub's new React-based Pull Requests list UI switches between the
// "Open"/"Closed" tabs (and sort/filter options) via client-side routing,
// without a full page reload, so this content script never gets re-injected.
// Watch for DOM changes and re-run the tweak whenever the URL actually changes.
// We also piggyback on this same observer to self-heal any branch info/skeletons
// that GitHub's own React re-renders may have wiped out (see restoreBranchInfo),
// and to colorize (read-only, no picker) branch names inside GitHub's own PR
// hovercard, the individual PR page's header, and its conversation timeline as
// soon as they're rendered (see colorizeHovercardBranches/
// colorizePrHeaderBranches/colorizePrTimelineBranches).
new MutationObserver(function () {
    tweakIfUrlChanged();
    restoreBranchInfo();
    colorizeHovercardBranches();
    colorizePrHeaderBranches();
    colorizePrTimelineBranches();
}).observe(document.body, {childList: true, subtree: true});
window.addEventListener("popstate", tweakIfUrlChanged);

// The PR hovercard and an individual PR page's header/timeline aren't part of
// the Pull Requests list, so they're not covered by tweak() above (which only
// runs for "/pulls" URLs) - load branchColors independently and run an initial
// pass in case any of them is already present on page load.
loadBranchColorsThen(function () {
    colorizeHovercardBranches();
    colorizePrHeaderBranches();
    colorizePrTimelineBranches();
});

// Loads branchColors from storage, then runs the given callback. Shared by
// tweak() (the Pull Requests list) and the standalone branch-colorizing features
// below (PR hovercard, individual PR page header/timeline) that need up-to-date
// colors but aren't tied to the list at all - see the call above.
function loadBranchColorsThen(callback) {
    chrome.storage.local.get("branchColors", function (items) {
        if (items.branchColors) {
            let branchColorsJSON = Object.entries(JSON.parse(items.branchColors))
            branchColors = new Map(branchColorsJSON);
        }
        callback();
    });
}

function tweak() {
    let windowUrl = window.location.href;

    if (!windowUrl.includes("/pulls")) {
        return;
    }
    window.initializeColorPickerSupport();
    baseUrl = windowUrl.substring(0, windowUrl.lastIndexOf("/"));

    loadBranchColorsThen(function () {
        promises = [];
        branchInfoByPullRequestNumber.clear();
        insertProgressBar();
        collectData();
        retrieveBranchMap();
        populateDOM();
    });
}

// A thin animated line at the very top of the page, matching GitHub's own
// page-loading progress bar, used to show branch-info fetch progress.
let progressMax = 0;
let progressBarFill = null;

function ensureProgressBarStyles() {
    if (document.getElementById("ght-progress-bar-styles")) {
        return;
    }
    let style = document.createElement("style");
    style.setAttribute(DIV_ID, "ght-progress-bar-styles");
    style.textContent = `
        .ght-top-progress-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            z-index: 2000;
            background: transparent;
            pointer-events: none;
            opacity: 1;
            transition: opacity 0.3s ease-out;
        }
        .ght-top-progress-bar-fill {
            height: 100%;
            width: 0%;
            background: var(--fgColor-accent, #0969da);
            box-shadow: 0 0 8px var(--fgColor-accent, #0969da);
            transition: width 0.2s ease-out;
        }
    `;
    document.head.appendChild(style);
}

function insertProgressBar() {
    let existingBar = document.getElementById("progressDiv");
    if (existingBar !== null) {
        // Bar already exists from a previous run (e.g. switching between the
        // Open/Closed tabs on GitHub's client-side routed Pull Requests list).
        // Reuse it, reset it, and make it visible again.
        progressBarFill = existingBar.querySelector(".ght-top-progress-bar-fill");
        progress = 0;
        progressMax = 0;
        updateProgressBarFill();
        setProgressBarsVisible(true);
        return;
    }

    ensureProgressBarStyles();

    let progressBar = document.createElement("div");
    progressBar.setAttribute(DIV_ID, "progressDiv");
    progressBar.className = "ght-top-progress-bar";

    progressBarFill = document.createElement("div");
    progressBarFill.className = "ght-top-progress-bar-fill";
    progressBar.appendChild(progressBarFill);

    document.body.appendChild(progressBar);
}

function collectData() {
    collectPullRequestDIVs();
    let hasIncompleteRow = false;

    for (let pullRequestDiv of pullRequestDivs) {
        // GitHub's client-side router (e.g. navigating via browser back/forward
        // between the Open/Closed tabs) can briefly render a PR row's <li> before
        // its title link has been filled in yet. Skip it for now to avoid crashing
        // on a missing element, and retry shortly after below - by then React will
        // have finished rendering it.
        if (!getTitleLink(pullRequestDiv)) {
            hasIncompleteRow = true;
            continue;
        }
        collectURLs(pullRequestDiv);
        modifyTargetDIVS(pullRequestDiv);
        reassignCommitButtonOnClickAction(pullRequestDiv);
        insertCommitsButtonNow(pullRequestDiv);
    }

    if (hasIncompleteRow) {
        setTimeout(tweak, 150);
    }

    progressMax = urls.size;
    updateProgressBarFill();
}

// On the new UI, the Commits button doesn't depend on the (slower) branch-name
// fetch at all, so show it immediately instead of waiting for that fetch/skeleton
// to resolve. It's inserted as part of the same single "ght-branch-info" container
// as the branch names/skeleton (see createBranchContainerElement) - rather than as
// a separate sibling element - so the whole block (branch info + button) wraps
// together as one no-wrap unit.
function insertCommitsButtonNow(pullRequestDiv) {
    if (!isNewUI(pullRequestDiv)) {
        return;
    }

    let pullRequestNumber = getPullRequestNumber(pullRequestDiv);
    let descriptionDiv = getDescriptionDiv(pullRequestDiv);
    if (!descriptionDiv || descriptionDiv.querySelector("." + BRANCH_INFO_CLASS)) {
        return;
    }

    let state = branchInfoByPullRequestNumber.get(pullRequestNumber)
        || setBranchInfoState(pullRequestNumber, {done: false, commitsOn: false});

    insertBranchInfo(descriptionDiv, createBranchContainerElement(pullRequestNumber, state));
}

function incrementProgress() {
    progress++;
    updateProgressBarFill();
}

function updateProgressBarFill() {
    if (!progressBarFill) {
        return;
    }
    let percent = progressMax > 0 ? Math.min(100, (progress / progressMax) * 100) : 0;
    progressBarFill.style.width = percent + "%";
}

function setProgressBarsVisible(visible) {
    let progressBar = document.getElementById("progressDiv");
    if (progressBar) {
        progressBar.style.opacity = visible ? "1" : "0";
    }
}

function collectPullRequestDIVs() {
    let legacyRows = document.getElementsByClassName(
        "Box-row Box-row--focus-gray p-0 mt-0 js-navigation-item js-issue-row"
    );
    pullRequestDivs = legacyRows.length > 0 ? legacyRows : document.querySelectorAll(NEW_UI_ROW_SELECTOR);
}

function isNewUI(pullRequestDiv) {
    return pullRequestDiv.matches(NEW_UI_ROW_SELECTOR);
}

function getTitleLink(pullRequestDiv) {
    return (
        pullRequestDiv.querySelector('a[data-testid="listitem-title-link"]') ||
        pullRequestDiv.getElementsByTagName("a")[0]
    );
}

function getPullRequestNumber(pullRequestDiv) {
    let idAttribute = pullRequestDiv.getAttribute(DIV_ID);
    if (idAttribute && idAttribute.startsWith(ISSUE_PREFIX)) {
        return idAttribute.split("_").pop();
    }

    let href = getTitleLink(pullRequestDiv).getAttribute("href");
    return href.split("/").filter(Boolean).pop();
}

function findPullRequestRowByNumber(pullRequestNumber) {
    let legacyDiv = document.getElementById(ISSUE_PREFIX + pullRequestNumber);
    if (legacyDiv !== null) {
        return legacyDiv;
    }

    let titleLink = document.querySelector(
        'a[data-testid="listitem-title-link"][href$="/pull/' + pullRequestNumber + '"]'
    );
    return titleLink !== null ? titleLink.closest("li") : null;
}

function toRelativeUrl(href) {
    return new URL(href, location.origin).pathname;
}

function getDescriptionDiv(pullRequestDiv) {
    return pullRequestDiv.querySelector('div[class*="Description-module__container"]');
}

function insertBranchInfo(descriptionDiv, branchSpanElement) {
    // Place the branch badge right after the timestamp ("opened ... ago") text.
    // We anchor on the timestamp rather than on the review-decision indicator
    // (e.g. "Approved") because that indicator only carries its
    // `review-decision-icon` testid once GitHub's own data has finished loading;
    // while it's still showing its own loading skeleton, looking it up would fail
    // and we'd fall back to appending at the very end (after that skeleton). The
    // timestamp, on the other hand, is present from the very first paint, so
    // anchoring there keeps our badge positioned correctly before the
    // review-decision area in both its loading and resolved states.
    let timestampContainer = descriptionDiv.querySelector('[data-testid="timestamp-container"]');
    if (timestampContainer) {
        descriptionDiv.insertBefore(branchSpanElement, timestampContainer.nextSibling);
        return;
    }

    let reviewDecisionIcon = descriptionDiv.querySelector('[data-testid="review-decision-icon"]');
    if (reviewDecisionIcon) {
        descriptionDiv.insertBefore(branchSpanElement, reviewDecisionIcon);
    } else {
        descriptionDiv.appendChild(branchSpanElement);
    }
}

const BRANCH_SKELETON_CLASS = "ght-branch-skeleton";
const BRANCH_INFO_CLASS = "ght-branch-info";
const COMMIT_BUTTON_CLASS = "ght-commits-button";

function ensureSkeletonStyles() {
    if (document.getElementById("ght-skeleton-styles")) {
        return;
    }
    let style = document.createElement("style");
    style.setAttribute(DIV_ID, "ght-skeleton-styles");
    style.textContent = `
        .${BRANCH_INFO_CLASS},
        .${BRANCH_SKELETON_CLASS},
        .${COMMIT_BUTTON_CLASS},
        .ght-separator {
            /* These elements are inserted directly as children of GitHub's own
               (flex) row container, so without this they can get stretched to
               the row's full height / top-aligned instead of vertically
               centered alongside GitHub's own content. */
            align-self: center;
        }
        .${BRANCH_SKELETON_CLASS} {
            display: inline-flex;
            align-items: center;
            font-size: var(--text-body-size-small, 0.75rem);
            color: var(--fgColor-muted, #59636e);
            font-weight: 400;
        }
        .${BRANCH_SKELETON_CLASS} .ght-skeleton-bar {
            display: inline-block;
            box-sizing: border-box;
            height: 12px;
            border-radius: var(--borderRadius-small, 0.1875rem);
            background-color: var(--skeletonLoader-bgColor, #818b981a);
            animation: ght-skeleton-shimmer;
        }
        @media (prefers-reduced-motion: no-preference) {
            .${BRANCH_SKELETON_CLASS} .ght-skeleton-bar {
                mask-image: linear-gradient(75deg, #000 30%, rgba(0, 0, 0, 0.65) 80%);
                mask-size: 200%;
                animation: ght-skeleton-shimmer;
                animation-duration: 1s;
                animation-iteration-count: infinite;
            }
        }
        @keyframes ght-skeleton-shimmer {
            from { mask-position: 200%; }
            to { mask-position: 0%; }
        }
    `;
    document.head.appendChild(style);
}

function createSkeletonBar(width) {
    let bar = document.createElement("span");
    bar.className = "ght-skeleton-bar";
    bar.style.width = width + "px";
    return bar;
}

function createBranchSkeletonElement() {
    ensureSkeletonStyles();
    let skeleton = document.createElement("span");
    skeleton.className = BRANCH_SKELETON_CLASS;
    skeleton.setAttribute("aria-hidden", "true");
    skeleton.appendChild(createTextSpanElement("·"));
    skeleton.appendChild(createSkeletonBar(64));
    skeleton.appendChild(createTextSpanElement("←"));
    skeleton.appendChild(createSkeletonBar(64));

    return skeleton;
}

// Minimum time to keep a skeleton visible before swapping in the real branch info.
// Without this, fast/local responses can resolve before the browser even paints the
// skeleton, making it look like it never appeared at all.
const MIN_SKELETON_VISIBLE_MS = 400;
let skeletonInsertedAt = new Map();

// GitHub's new UI keeps loading parts of the row asynchronously (e.g. the
// review-decision / checks status), and re-renders once that data arrives - wiping
// out whatever we injected (skeleton or resolved branch badge) in the process, since
// it isn't part of React's own render output. That re-render can go as far as
// replacing the row's `<li>` and/or description container elements outright (not
// just mutating their children), so rather than watching specific nodes (which can
// become stale/detached), we re-resolve everything from scratch - by PR number -
// from the top-level `document.body` observer above every time any DOM mutation
// happens on the page, and restore whatever should currently be showing.
let branchInfoByPullRequestNumber = new Map(); // pullRequestNumber -> {done, baseBranch?, comparingBranch?, commitsOn}

// Merge into any existing state for this PR instead of clobbering fields (e.g. the
// Commits button's on/off state) tracked by other parts of the flow.
function setBranchInfoState(pullRequestNumber, partialState) {
    let state = branchInfoByPullRequestNumber.get(pullRequestNumber) || {};
    Object.assign(state, partialState);
    branchInfoByPullRequestNumber.set(pullRequestNumber, state);
    return state;
}

function restoreBranchInfo() {
    for (let [pullRequestNumber, state] of branchInfoByPullRequestNumber) {
        let pullRequestDiv = findPullRequestRowByNumber(pullRequestNumber);
        if (!pullRequestDiv) {
            continue;
        }

        let descriptionDiv = getDescriptionDiv(pullRequestDiv);
        if (!descriptionDiv) {
            continue;
        }

        // If this PR's Commits fetch is currently in flight, don't rebuild its
        // container right now: we'd orphan its button mid-fetch - the in-flight
        // request's callback still holds a reference to it and will happily keep
        // acting on it (updating its id/icon) once it resolves, but that node
        // would no longer be attached to the page - so the *visible* (freshly
        // rebuilt) button would incorrectly sit there showing "off"/idle, even
        // though the fetch it no longer controls goes on to insert commit content
        // behind its back. Clicking that seemingly-idle button then re-triggers
        // the whole thing again, producing a second, duplicate commits block.
        // Deferring any rebuild until the fetch settles avoids creating that
        // window entirely. This only affects this one PR - other rows still get
        // restored normally in the meantime.
        //
        // Branch info/skeleton and the Commits button now live together inside a
        // single "ght-branch-info" container (see createBranchContainerElement), so
        // one existence check covers both.
        //
        // Check by marker class rather than by id: React can end up reusing/patching
        // a DOM node in place during its own reconciliation, overwriting its content
        // while leaving our `id` attribute untouched since React never claimed to
        // manage it - so an id-based existence check would wrongly think our
        // container is still intact. The marker class only survives if the node's
        // content is genuinely still ours.
        if (!isButtonBlocked(pullRequestNumber) && !descriptionDiv.querySelector("." + BRANCH_INFO_CLASS)) {
            insertBranchInfo(descriptionDiv, createBranchContainerElement(pullRequestNumber, state));
        }

        // The Commits button can end up looking completely intact (same id, same
        // classes, same inline "cursor: pointer" style - all HTML attributes) while
        // silently losing its "onclick" handler, if React ever clones/recreates this
        // exact DOM node during its own reconciliation: attributes get copied over,
        // but a JS-property-assigned event handler like this one doesn't survive
        // cloning. That leaves a button that looks completely normal (and even
        // shows a pointer cursor on hover) but does nothing when clicked. Since our
        // marker-class-based existence check above can't detect this (the node is
        // still there, still has the class), just unconditionally re-attach the
        // handler on every pass - cheap, and idempotent either way.
        reassignCommitButtonOnClickAction(pullRequestDiv);
    }
}

function insertBranchSkeleton(url) {
    let pullRequestNumber = url.split("/").pop();
    let pullRequestDiv = findPullRequestRowByNumber(pullRequestNumber);
    if (!pullRequestDiv) {
        return;
    }

    skeletonInsertedAt.set(url, Date.now());

    if (isNewUI(pullRequestDiv)) {
        // insertCommitsButtonNow() already shows a loading container (branch
        // skeleton + Commits button combined) immediately for the new UI; nothing
        // more to do here beyond tracking the timestamp above, used for
        // MIN_SKELETON_VISIBLE_MS.
        return;
    }

    let targetDiv = getDivToReplace(pullRequestDiv);
    if (!targetDiv || targetDiv.querySelector("." + BRANCH_SKELETON_CLASS)) {
        return;
    }
    targetDiv.appendChild(createBranchSkeletonElement());
}

function collectURLs(pullRequestDiv) {
    let url = toRelativeUrl(getTitleLink(pullRequestDiv).getAttribute("href"));
    urls.add(url);

    let pullRequestNumber = getPullRequestNumber(pullRequestDiv);
    let suffix = "/pull/" + pullRequestNumber;
    let repoPath = url.endsWith(suffix) ? url.slice(0, -suffix.length) : "";
    pullRequestBaseUrls.set(pullRequestNumber, "https://github.com" + repoPath);
}

function modifyTargetDIVS(pullRequestDiv) {
    if (isNewUI(pullRequestDiv)) {
        // New UI: the branch badge is appended directly to the live description div
        // in populateDOM() instead, so we don't disturb GitHub's own React-managed
        // content (e.g. the checks badge / review-decision indicator), which would
        // otherwise get reset to a loading skeleton when its container is replaced.
        return;
    }

    let pullRequestNumber = getPullRequestNumber(pullRequestDiv);
    let targetDiv = getDivToReplace(pullRequestDiv);
    if (!targetDiv) {
        return;
    }
    let newChildDiv = document.createElement("div");
    newChildDiv.setAttribute("style", "display: inline-block;");
    newChildDiv.innerHTML = targetDiv.innerHTML;
    if (newChildDiv.firstElementChild) {
        newChildDiv.firstElementChild.setAttribute("style", "margin-right: 2px;");
    }
    let newDivToInsert = createDivElement(targetDiv);
    newDivToInsert.appendChild(newChildDiv);
    modifiedTargetDivs.set(pullRequestNumber, newDivToInsert);
}

function createDivElement(originalDiv) {
    let divElement = document.createElement("div");
    divElement.setAttribute("class", originalDiv.className);

    return divElement;
}

function retrieveBranchMap() {
    for (let url of urls) {
        if (!branchMap.has(url)) {
            insertBranchSkeleton(url);
            promises.push(createHttpRequest("GET", url));
        } else {
            incrementProgress();
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
                incrementProgress();
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
    xhr.setRequestHeader("accept", "text/html");
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
    return data.querySelectorAll('[class*="prc-BranchName-BranchName"]')[0].innerHTML;
}

function getComparingBranch(data) {
    return data.querySelectorAll('[class*="prc-BranchName-BranchName"]')[1].innerHTML;
}

function populateDOM() {
    // `allSettled` (rather than `all`) ensures a single failed request doesn't leave
    // every other row's skeleton stuck forever.
    Promise.allSettled(promises).then(function () {
        for (let url of urls) {
            applyBranchInfoForUrl(url);
        }

        urls.clear();
        completeProgressBar();
    });
}

function completeProgressBar() {
    // Jump to 100% to signal completion (mirrors GitHub's own top-loading-bar
    // behavior), then fade out and reset, ready for the next run.
    progress = progressMax;
    updateProgressBarFill();
    setTimeout(function () {
        setProgressBarsVisible(false);
        progress = 0;
        progressMax = 0;
        updateProgressBarFill();
    }, 250);
}

function applyBranchInfoForUrl(url) {
    let insertedAt = skeletonInsertedAt.get(url);
    let remainingDelay = insertedAt ? MIN_SKELETON_VISIBLE_MS - (Date.now() - insertedAt) : 0;

    if (remainingDelay > 0) {
        setTimeout(function () {
            finalizeBranchInfoForUrl(url);
        }, remainingDelay);
    } else {
        finalizeBranchInfoForUrl(url);
    }
}

function finalizeBranchInfoForUrl(url) {
    skeletonInsertedAt.delete(url);

    let pullRequestNumber = url.split("/").pop();
    let pullRequestDiv = findPullRequestRowByNumber(pullRequestNumber);
    if (pullRequestDiv == null) {
        return;
    }

    if (!branchMap.has(url)) {
        // Fetching the branch info for this PR failed; remember not to keep
        // re-showing a skeleton for it. The Commits button is unaffected and stays
        // visible - it lives in the same container, rebuilt below without branch
        // info (see createBranchContainerElement's `state.failed` handling).
        setBranchInfoState(pullRequestNumber, {done: true, failed: true});
        if (isNewUI(pullRequestDiv)) {
            replaceBranchContainer(pullRequestDiv, pullRequestNumber);
        }
        return;
    }

    let baseBranch = branchMap.get(url).split(":")[0];
    let comparingBranch = branchMap.get(url).split(":")[1];

    if (isNewUI(pullRequestDiv)) {
        setBranchInfoState(pullRequestNumber, {done: true, baseBranch, comparingBranch});
        replaceBranchContainer(pullRequestDiv, pullRequestNumber);
        return;
    }

    if (notExistsSourceElement(pullRequestDiv)) {
        let divToReplace = getDivToReplace(pullRequestDiv);
        if (divToReplace) {
            divToReplace.replaceWith(getModifiedTargetDiv(pullRequestNumber, baseBranch, comparingBranch));
        }
    }
}

// Rebuilds the single "ght-branch-info" container (branch info/skeleton + Commits
// button) for this PR from its current tracked state. Used whenever the branch
// fetch settles (success or failure), replacing whatever was showing before
// (skeleton, most likely) in one go.
function replaceBranchContainer(pullRequestDiv, pullRequestNumber) {
    let descriptionDiv = getDescriptionDiv(pullRequestDiv);
    if (!descriptionDiv) {
        return;
    }
    let existingContainer = descriptionDiv.querySelector("." + BRANCH_INFO_CLASS);
    if (existingContainer) {
        existingContainer.remove();
    }
    insertBranchInfo(
        descriptionDiv,
        createBranchContainerElement(pullRequestNumber, branchInfoByPullRequestNumber.get(pullRequestNumber))
    );
}

// Legacy UI only (see finalizeBranchInfoForUrl) - guards against a duplicate
// insertion of the branch info + Commits button block.
function notExistsSourceElement(pullRequestDiv) {
    return pullRequestDiv.getElementsByClassName(BRANCH_INFO_CLASS).length === 0;
}

function getDivToReplace(pullRequestDiv) {
    return isNewUI(pullRequestDiv)
        ? getDescriptionDiv(pullRequestDiv)
        : pullRequestDiv.getElementsByClassName("d-flex mt-1 text-small color-fg-muted")[0];
}

function getModifiedTargetDiv(pullRequestNumber, baseBranch, comparingBranch) {
    let modifiedTargetDiv = modifiedTargetDivs.get(pullRequestNumber);
    modifiedTargetDiv.children[0].insertBefore(
        createMainBranchSpanElement(baseBranch, comparingBranch, pullRequestNumber), modifiedTargetDiv.children[0].childNodes[2]
    );

    return modifiedTargetDiv;
}

// Legacy UI only: branch info + Commits button, inserted together as a single
// cloned block once the branch-name fetch resolves (the legacy UI has no
// "immediate" Commits button - see insertCommitsButtonNow).
function createMainBranchSpanElement(baseBranch, comparingBranch, pullRequestNumber) {
    let outerBranchSpanElement = createOuterBranchSpanElement();
    outerBranchSpanElement.appendChild(createTextSpanElement("·"));
    outerBranchSpanElement.appendChild(createBranchSpanElement(baseBranch));
    outerBranchSpanElement.appendChild(createTextSpanElement("←"));
    outerBranchSpanElement.appendChild(createBranchSpanElement(comparingBranch));
    outerBranchSpanElement.appendChild(createTextSpanElement("·"));
    outerBranchSpanElement.appendChild(createCommitsButton(pullRequestNumber, false));

    return outerBranchSpanElement;
}

// New UI only: a single "ght-branch-info" container holding the branch names (or
// a loading skeleton, or nothing if the fetch failed) *and* the Commits button
// together, so the whole block wraps as one no-wrap unit.
function createBranchContainerElement(pullRequestNumber, state) {
    let outerBranchSpanElement = createOuterBranchSpanElement();
    outerBranchSpanElement.classList.toggle(BRANCH_SKELETON_CLASS, !state.done);
    outerBranchSpanElement.appendChild(createTextSpanElement("·"));

    if (!state.failed) {
        if (state.done) {
            outerBranchSpanElement.appendChild(createBranchSpanElement(state.baseBranch));
            outerBranchSpanElement.appendChild(createTextSpanElement("←"));
            outerBranchSpanElement.appendChild(createBranchSpanElement(state.comparingBranch));
        } else {
            outerBranchSpanElement.appendChild(createSkeletonBar(64));
            outerBranchSpanElement.appendChild(createTextSpanElement("←"));
            outerBranchSpanElement.appendChild(createSkeletonBar(64));
        }
        outerBranchSpanElement.appendChild(createTextSpanElement("·"));
    }

    outerBranchSpanElement.appendChild(createCommitsButton(pullRequestNumber, state.commitsOn));

    return outerBranchSpanElement;
}

function createCommitsButton(pullRequestNumber, isOn) {
    ensureSkeletonStyles();
    let button = createButton(
        "Commits",
        pullRequestNumber,
        COMMIT_BUTTON_PREFIX,
        COMMIT_LIST_IMAGE_PATH,
        function () {
            onClickCommitsButton(this);
        }
    );

    button.classList.add(COMMIT_BUTTON_CLASS);

    if (isOn) {
        button.setAttribute(DIV_ID, COMMIT_BUTTON_PREFIX + pullRequestNumber + ON);
    }

    return button;
}

function createOuterBranchSpanElement() {
    ensureSkeletonStyles();
    let spanElement = document.createElement("span");
    spanElement.setAttribute("style", "white-space:nowrap;");
    spanElement.classList.add(BRANCH_INFO_CLASS);

    return spanElement;
}

function createBranchSpanElement(branchName) {
    let branchSpanElement = document.createElement("span");
    branchSpanElement.setAttribute(
        "class",
        "commit-ref css-truncate css-truncate-target user-select-contain base-r"
    );
    branchSpanElement.setAttribute("title", branchName);
    // GitHub's own ".commit-ref" class sets "vertical-align: top", which - since
    // vertical-align is not an inherited property - pushes this pill to the top
    // of the (taller) line box instead of aligning it with the surrounding text.
    // Override it inline (higher specificity than the class) to vertically
    // center it instead. The ".css-truncate"/".css-truncate-target" classes also
    // nudge things slightly off, hence the small "top" correction on top of that.
    branchSpanElement.setAttribute(
        "style",
        "vertical-align:middle;position:relative;top:-1px;" + getBranchColorStyle(branchName)
    );
    branchSpanElement.dataset.branchName = branchName;
    branchSpanElement.addEventListener("click", function (event) {
        event.stopPropagation();
        window.openBranchColorPicker(event.currentTarget, branchName, branchColors, computeBranchElementStyle, persistBranchColors);
    });

    branchSpanElement.appendChild(document.createTextNode(branchName));

    return branchSpanElement;
}

function getBranchColorStyle(branchName, backgroundOverride, textOverride) {
    let backgroundColor = backgroundOverride ?? branchColors.get(branchName)?.backgroundColor;
    let textColor = textOverride ?? branchColors.get(branchName)?.textColor;
    let style = "";

    if (backgroundColor && textColor) {
        style += "background-color: " + backgroundColor + "; color: " + textColor + ";";
    }

    style += "max-width: 500px; font: 0.85em/1.7 ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace";
    return style;
}

// Same idea as getBranchColorStyle(), but for a branch name pill inside GitHub's
// own PR hovercard instead of our PR list row. That hovercard already has its own
// (non-monospace) font and relies on an explicit narrow "max-width" for its
// "css-truncate-target" ellipsis truncation to kick in - reusing
// getBranchColorStyle()'s wider max-width/monospace font would both break that
// truncation and look visually inconsistent with the rest of the hovercard's text.
// Read-only (no picker here), so no "cursor: pointer".
function getHovercardBranchColorStyle(branchName, backgroundOverride, textOverride) {
    let backgroundColor = backgroundOverride ?? branchColors.get(branchName)?.backgroundColor;
    let textColor = textOverride ?? branchColors.get(branchName)?.textColor;
    let style = "max-width: 140px;";

    if (backgroundColor && textColor) {
        style += "background-color: " + backgroundColor + "; color: " + textColor + ";";
    }

    return style;
}

// Same idea again, but for the base/head branch links inside an individual PR
// page's own header. Unlike the other two, this is a plain GitHub link with no
// pill-like padding/background of its own by default - only add those when a
// custom color is actually set, so an unstyled branch keeps looking exactly like
// GitHub's own default rendering.
function getPrHeaderBranchColorStyle(branchName, backgroundOverride, textOverride) {
    let backgroundColor = backgroundOverride ?? branchColors.get(branchName)?.backgroundColor;
    let textColor = textOverride ?? branchColors.get(branchName)?.textColor;
    let style = "";

    if (backgroundColor && textColor) {
        style += "background-color: " + backgroundColor + "; color: " + textColor + "; border-radius: 6px; padding: 0 6px;";
    }

    return style;
}

// Same idea again, but for branch names inside a PR's own conversation timeline
// (see PR_TIMELINE_BRANCH_CLASS above). Like the PR page header, this sits inline
// in plain GitHub text with no pill-like background of its own by default - only
// add one when a custom color is actually set.
function getPrTimelineBranchColorStyle(branchName, backgroundOverride, textOverride) {
    let backgroundColor = backgroundOverride ?? branchColors.get(branchName)?.backgroundColor;
    let textColor = textOverride ?? branchColors.get(branchName)?.textColor;
    let style = "";

    if (backgroundColor && textColor) {
        style += "background-color: " + backgroundColor + "; color: " + textColor + "; border-radius: 6px; padding: 0 4px;";
    }

    return style;
}

// The color picker (opened only from our own PR list branch pills) restyles
// every element sharing a given branch name, including read-only colorized
// branches elsewhere on the page (GitHub's own PR hovercard, an individual PR
// page's header, and its conversation timeline) - each of which needs a
// different style computation (see getHovercardBranchColorStyle()/
// getPrHeaderBranchColorStyle()/getPrTimelineBranchColorStyle() above). Dispatch
// on the element actually being recolored rather than baking one style function
// in at the call site, so a single color change re-styles every matching
// element correctly.
function computeBranchElementStyle(element, branchName, backgroundOverride, textOverride) {
    if (element.classList.contains(HOVERCARD_BRANCH_CLASS)) {
        return getHovercardBranchColorStyle(branchName, backgroundOverride, textOverride);
    }
    if (element.classList.contains(PR_HEADER_BRANCH_CLASS)) {
        return getPrHeaderBranchColorStyle(branchName, backgroundOverride, textOverride);
    }
    if (element.classList.contains(PR_TIMELINE_BRANCH_CLASS)) {
        return getPrTimelineBranchColorStyle(branchName, backgroundOverride, textOverride);
    }
    return getBranchColorStyle(branchName, backgroundOverride, textOverride);
}

// GitHub's PR hovercard (the popup shown when hovering a PR title link) is
// fetched fresh via XHR and injected into the DOM each time it's shown, with its
// base/head branch names rendered as "<span class='commit-ref ...' id='base-ref-
// <id>'>"/"id='head-ref-<id>'" elements. Recolor them the same way as our own PR
// list branch pills, matching branchColors by name - read-only, no picker (the
// color picker is only available from the PR list itself).
function colorizeHovercardBranches() {
    let selector = 'span.commit-ref[id^="base-ref-"]:not(.' + HOVERCARD_BRANCH_CLASS + '), '
        + 'span.commit-ref[id^="head-ref-"]:not(.' + HOVERCARD_BRANCH_CLASS + ')';
    document.querySelectorAll(selector).forEach(function (span) {
        let branchName = span.textContent.trim();
        if (!branchName) {
            return;
        }
        span.classList.add(HOVERCARD_BRANCH_CLASS);
        span.dataset.branchName = branchName;
        span.setAttribute("style", getHovercardBranchColorStyle(branchName));
    });
}

// An individual PR page's own header ("<user> merged/wants to merge N commits
// into <base> from <head>") renders the base/head branch names as real links to
// each branch's file tree. Recolor them (read-only, no picker) - a normal click
// still navigates through to the branch as usual, since we don't attach any
// listener here.
function colorizePrHeaderBranches() {
    let selector = PR_HEADER_BRANCHES_CONTAINER_SELECTOR
        + ' a[data-component="BranchName"]:not(.' + PR_HEADER_BRANCH_CLASS + ')';
    document.querySelectorAll(selector).forEach(function (link) {
        let branchName = link.textContent.trim();
        if (!branchName) {
            return;
        }
        link.classList.add(PR_HEADER_BRANCH_CLASS);
        link.dataset.branchName = branchName;
        link.setAttribute("style", getPrHeaderBranchColorStyle(branchName));
    });
}

// A PR's conversation timeline shows branch names inline in various events
// ("merged commit X into <base>", force-pushes, etc.), using GitHub's classic
// nested ".commit-ref" markup (see PR_TIMELINE_BRANCH_CLASS above) rather than
// the newer components used elsewhere on the page. Recolor them (read-only, no
// picker).
function colorizePrTimelineBranches() {
    // Style the *outer* ".commit-ref" wrapper, not the inner ".css-truncate-
    // target" text span: GitHub's own default "pill" look (light blue
    // background, padding, border-radius) for these classic timeline badges is
    // painted on this outer element (and/or the ".base-ref"/".head-ref" one
    // nested just inside it) - coloring only the innermost text span left that
    // default background still visible around/behind our color. Exclude
    // ".css-truncate-target" itself from the selector so this doesn't also match
    // our own flat, single-element PR list pills or the hovercard's chips (both
    // of which have "commit-ref" and "css-truncate-target" on the very same
    // element, unlike this nested structure).
    let selector = 'span.commit-ref:not(.css-truncate-target):not(.' + PR_TIMELINE_BRANCH_CLASS + ')';
    document.querySelectorAll(selector).forEach(function (wrapper) {
        let textSpan = wrapper.querySelector(".css-truncate-target");
        let branchName = (textSpan || wrapper).textContent.trim();
        if (!branchName) {
            return;
        }
        wrapper.classList.add(PR_TIMELINE_BRANCH_CLASS);
        wrapper.dataset.branchName = branchName;
        wrapper.setAttribute("style", getPrTimelineBranchColorStyle(branchName));
        // Clear out GitHub's own default background/text color on the nested
        // ".base-ref"/".head-ref"/".css-truncate-target" spans so they don't
        // paint their own color underneath/around ours - only needs doing once,
        // since we never touch these nested elements again afterwards (later
        // recolors only update the outer wrapper's style, see
        // computeBranchElementStyle).
        wrapper.querySelectorAll(".base-ref, .head-ref, .css-truncate-target").forEach(function (nested) {
            nested.style.backgroundColor = "transparent";
            nested.style.color = "inherit";
        });
    });
}

function createTextSpanElement(innerText) {
    ensureSkeletonStyles();
    let textSpanElement = document.createElement("span");
    textSpanElement.setAttribute("class", "mx-1 ght-separator");
    textSpanElement.appendChild(document.createTextNode(innerText));

    return textSpanElement;
}

function reassignCommitButtonOnClickAction(pullRequestDiv) {
    let pullRequestNumber = getPullRequestNumber(pullRequestDiv);
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
}

function createButton(branchName, pullRequestNumber, idPrefix, imagePath, onClickAction) {
    let button = document.createElement("div");
    let buttonId = idPrefix + pullRequestNumber + OFF;
    button.setAttribute(DIV_ID, buttonId);
    button.setAttribute("class", "commit-ref css-truncate css-truncate-target user-select-contain base-r");
    button.setAttribute("style", BUTTON_STYLE);
    button.setAttribute("title", branchName);
    button.appendChild(createImage(imagePath));
    button.dataset.url = (pullRequestBaseUrls.get(pullRequestNumber) || baseUrl) + "/pull/" + pullRequestNumber;
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
    // SVGs default to "vertical-align: baseline", which leaves room for a
    // descender and makes the icon sit visibly low inside its (grey) button
    // div. Center it instead.
    image.style.verticalAlign = "middle";

    return image;
}

function onClickCommitsButton(button) {
    let action = button.getAttribute(DIV_ID).split("_").pop();
    let pullRequestNumber = button.getAttribute(DIV_ID).split("_")[3];
    if (action === "off" && !isButtonBlocked(pullRequestNumber)) {
        blockButton(pullRequestNumber);
        turnOnSpinner(button);
        makeRequest("GET", button.dataset.url + "/commits", function (err, xhr) {
            // Always unblock this PR and turn its spinner back off, no matter what
            // happens below - otherwise (especially likely on a slow connection,
            // where the row/description div this all depends on has more time to
            // get replaced/removed from under us before the request resolves) a
            // thrown error or early return here would leave this button
            // permanently blocked, with no way to ever open it again.
            try {
                if (err) {
                    throw err;
                }
                let response = xhr.response;
                applyCommitsStyle(response);
                let commitsDiv = response.querySelector('[data-testid="commits-list"]');
                if (!commitsDiv) {
                    return;
                }
                commitsDiv.setAttribute(DIV_ID, COMMIT_CONTENT_PREFIX + pullRequestNumber);
                commitsDiv.classList.add(COMMIT_CONTENT_CLASS);
                commitsDiv.setAttribute("style", TOP_BORDER_STYLE);
                removeDeferredSkeletons(commitsDiv);
                wireUpCopyShaButtons(commitsDiv);
                Array.from(commitsDiv.getElementsByTagName('Button')).forEach(function (element) {
                    // The "copy full SHA" button is the one native <button> we
                    // actually want to keep (and just wired up above) - everything
                    // else here is a dead GitHub React control (no React runtime is
                    // attached to this detached, XHR-fetched HTML to make it do
                    // anything).
                    if (!element.classList.contains(COPY_SHA_BUTTON_CLASS)) {
                        element.remove();
                    }
                });

                // Defensive: if commit content for this PR is somehow already
                // showing (e.g. this button lost sync with the actual on/off state
                // and got clicked again), replace it instead of stacking a
                // duplicate copy underneath.
                let existingCommitsDiv = document.getElementById(COMMIT_CONTENT_PREFIX + pullRequestNumber);
                if (existingCommitsDiv) {
                    existingCommitsDiv.remove();
                }

                let pullRequestDiv = findPullRequestRowByNumber(pullRequestNumber);
                if (!pullRequestDiv) {
                    return;
                }
                pullRequestDiv.after(commitsDiv);
                button.setAttribute(DIV_ID, COMMIT_BUTTON_PREFIX + pullRequestNumber + ON);
                setBranchInfoState(pullRequestNumber, {commitsOn: true});
            } finally {
                unblockButton(pullRequestNumber);
                turnOffSpinner(button, COMMIT_LIST_IMAGE_PATH);
            }
        });
    } else if (action === "on") {
        let commitsDiv = document.getElementById(COMMIT_CONTENT_PREFIX + pullRequestNumber);
        if (commitsDiv) {
            commitsDiv.remove();
        }
        button.setAttribute(DIV_ID, COMMIT_BUTTON_PREFIX + pullRequestNumber + OFF);
        setBranchInfoState(pullRequestNumber, {commitsOn: false});
    }
}

// The commits list is fetched via a plain XHR (responseType "document"), which
// just parses GitHub's raw server HTML - no JS ever runs against it. Some parts of
// that HTML (e.g. the commit's relative-time, checks-status badge) are
// intentionally left as loading skeletons server-side and only get filled in by
// GitHub's own client-side JS via a follow-up request once the page actually loads
// in a browser. Since that never happens here, they'd otherwise sit there animating
// forever with no real data ever arriving - so just strip them out instead.
function removeDeferredSkeletons(commitsDiv) {
    commitsDiv.querySelectorAll('[class*="LoadingSkeleton-module__skeleton"]').forEach(function (skeleton) {
        skeleton.remove();
    });

    // Without a resolved timestamp (removed above), the standalone "committed"
    // label that normally sits right before it - with nothing following it now -
    // looks incomplete/dangling on its own. Drop it too.
    commitsDiv.querySelectorAll("span").forEach(function (span) {
        if (span.textContent.trim() !== "committed") {
            return;
        }
        let container = span.parentElement;
        if (container && !container.querySelector("relative-time")) {
            span.remove();
        }
    });
}

// GitHub's own "copy full SHA" button has no working click handler in this
// detached/unhydrated HTML (see removeDeferredSkeletons above), so it'd otherwise
// just get stripped out along with the other dead buttons below. Wire up our own
// clipboard-copy behavior instead, using the full SHA from the commit link's href
// sitting right next to it (the visible label is only the abbreviated SHA).
function wireUpCopyShaButtons(commitsDiv) {
    commitsDiv.querySelectorAll("button").forEach(function (button) {
        if (!button.querySelector(".octicon-copy")) {
            return;
        }

        let container = button.closest(".d-flex");
        let shaLink = container ? container.querySelector("a[href]") : null;
        let fullSha = shaLink ? shaLink.getAttribute("href").split("/").filter(Boolean).pop() : null;
        if (!fullSha) {
            return;
        }

        button.classList.add(COPY_SHA_BUTTON_CLASS);
        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            navigator.clipboard.writeText(fullSha).then(function () {
                // The copy icon's SVG has two overlapping <path>s (the two-page
                // icon shape) - swapping just one path's "d" attribute leaves the
                // other original path rendered underneath the checkmark, looking
                // like a mess. Swap out the whole icon element instead (and back
                // again after the timeout), matching GitHub's own behavior of
                // fully replacing the icon while copied.
                let icon = button.querySelector("svg");
                if (!icon) {
                    return;
                }
                let checkIcon = createCheckIcon();
                icon.replaceWith(checkIcon);
                setTimeout(function () {
                    checkIcon.replaceWith(icon);
                }, 1500);
            });
        });
    });
}

function createCheckIcon() {
    let icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("viewBox", "0 0 16 16");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    icon.setAttribute("fill", "currentColor");
    icon.style.verticalAlign = "text-bottom";
    icon.style.color = "var(--fgColor-success, #1a7f37)";

    let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", CHECK_ICON_PATH);
    icon.appendChild(path);

    return icon;
}

function applyCommitsStyle(response) {
    response.head.childNodes.forEach(node => {
        if (node.tagName === "LINK") {
            document.head.appendChild(node);
        }
    });
    response.querySelectorAll('[data-testid="author-avatar"]').forEach(div => {
        div.lastChild.style.color = "#59636e";
    })
}

function turnOnSpinner(element) {
    let image = element.getElementsByTagName("svg")[0];
    image.replaceWith(getSpinnerImage());
}

function turnOffSpinner(element, imagePath) {
    let image = element.getElementsByTagName("svg")[0];
    image.replaceWith(createImage(imagePath));
}

function isButtonBlocked(pullRequestNumber) {
    return blockedPullRequestNumbers.has(pullRequestNumber);
}

function blockButton(pullRequestNumber) {
    blockedPullRequestNumbers.add(pullRequestNumber);
}

function unblockButton(pullRequestNumber) {
    blockedPullRequestNumbers.delete(pullRequestNumber);
}

function persistBranchColors() {
    let branchColorsJSON = JSON.stringify(Object.fromEntries(branchColors));
    chrome.storage.local.set({"branchColors": branchColorsJSON});
}

