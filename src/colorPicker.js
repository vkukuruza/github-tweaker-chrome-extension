// Same two-path "copy" octicon GitHub itself uses for its own copy-to-clipboard
// buttons (e.g. the "copy full SHA" button on a commit), and the checkmark
// octicon it swaps in on a successful copy - built from raw path data instead of
// reusing GitHub's own hashed CSS-module button classes, since (unlike the
// commit content's copy button, which we wire up from GitHub's own fetched
// markup) this button is one we create ourselves, with no such classes to reuse.
const COPY_ICON_PATHS = [
    "M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z",
    "M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"
];
const CHECK_ICON_PATH = "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z";
// GitHub's own "x" octicon, used for the Close button.
const CLOSE_ICON_PATH = "M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.751.751 0 0 1-1.042 1.042L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z";
// Fallback colors used when a branch has no custom color set yet - matches
// GitHub's own default ".commit-ref" pill look. Shared between the initial
// picker values, the Default button's own "here's what default looks like"
// styling, and its reset action.
const DEFAULT_BG_COLOR = "#ddf4ff";
const DEFAULT_TEXT_COLOR = "#656d76";
// Same muted icon color GitHub itself uses for its own "copy full SHA" button
// (see applyCommitsStyle() in contentScript.js) - used here so our copy/close
// icons match it instead of defaulting to the popup's own (darker) button text
// color.
const MUTED_ICON_COLOR = "#59636e";

function createColorPickerIcon(pathData, color) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.fill = color || MUTED_ICON_COLOR;
    svg.style.display = 'block';

    (Array.isArray(pathData) ? pathData : [pathData]).forEach((d) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
    });

    return svg;
}

window.initializeColorPickerSupport = function () {
    if (document.getElementById('color-picker-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'color-picker-styles';
    style.textContent = `
        .color-picker-popup {
            position: fixed;
            background: var(--bgColor-default, var(--color-canvas-default));
            border: 1px solid var(--borderColor-default, var(--color-border-default));
            border-radius: 6px;
            padding: 6px;
            box-shadow: var(--shadow-floating-small, 0 8px 24px rgba(140, 149, 159, 0.2));
            z-index: 100;
            display: flex;
            gap: 4px;
            align-items: center;
        }
        
        .color-picker-popup input[type="color"],
        .color-picker-popup button {
            box-sizing: border-box;
            height: 24px;
        }

        .color-picker-popup input[type="color"] {
            cursor: pointer;
            border: 1px solid var(--borderColor-default, var(--color-border-default));
            border-radius: 4px;
            width: 24px;
            padding: 0;
        }
        
        .color-picker-popup input[type="color"]::-webkit-color-swatch-wrapper {
            padding: 0;
        }
        
        .color-picker-popup input[type="color"]::-webkit-color-swatch {
            border: none;
            border-radius: 3px;
        }
        
        .color-picker-popup button {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 8px;
            border: 1px solid var(--button-default-borderColor-rest, var(--color-btn-border));
            border-radius: 6px;
            background: var(--button-default-bgColor-rest, var(--color-btn-bg));
            cursor: pointer;
            font-size: 11px;
            font-weight: 400;
            color: var(--button-default-fgColor-rest, var(--color-btn-text));
            white-space: nowrap;
        }
        
        .color-picker-popup button:hover {
            background: var(--button-default-bgColor-hover, var(--color-btn-hover-bg));
            border-color: var(--button-default-borderColor-hover, var(--color-btn-hover-border));
        }
        
        .color-picker-popup button:active {
            background: var(--button-default-bgColor-active, var(--color-btn-active-bg));
        }

        .color-picker-popup button.icon-button {
            width: 24px;
            padding: 0;
            border: none;
            border-radius: 4px;
        }

        .color-picker-popup button.icon-button:hover {
            background: var(--button-default-bgColor-hover, var(--color-btn-hover-bg));
        }
    `;
    document.head.appendChild(style);
};

// branchElement: the PR list branch pill that was clicked to open this picker.
// getStyleForElement(element, branchName, backgroundOverride, textOverride):
// recomputes the inline style for any branch element sharing this branch name
// (the PR list pill itself, plus any read-only colorized branches elsewhere on
// the page); used both when applying a new color and when resetting to
// "Default".
window.openBranchColorPicker = function (branchElement, branchName, branchColors, getStyleForElement, persistBranchColors) {
    const existingPicker = document.querySelector('.color-picker-popup');
    if (existingPicker) {
        existingPicker.remove();
    }

    const currentBgColor = branchColors.get(branchName)?.backgroundColor || DEFAULT_BG_COLOR;
    const currentTextColor = branchColors.get(branchName)?.textColor || DEFAULT_TEXT_COLOR;

    const popup = document.createElement('div');
    popup.className = 'color-picker-popup';

    const bgPicker = document.createElement('input');
    bgPicker.type = 'color';
    bgPicker.value = currentBgColor;
    bgPicker.title = 'Background color';

    const textPicker = document.createElement('input');
    textPicker.type = 'color';
    textPicker.value = currentTextColor;
    textPicker.title = 'Text color';

    const defaultBtn = document.createElement('button');
    defaultBtn.textContent = 'default';
    // Show what "default" actually resets to, rather than leaving it looking
    // like every other plain button - same font as the branch pill itself (see
    // getBranchColorStyle()), plus its default colors. getBranchColorStyle()'s
    // "0.85em" is relative to *branchElement's* own ancestors (GitHub's PR row),
    // not the popup's (appended straight onto <body>, a completely different
    // font-size context) - copying the literal "0.85em..." string here would
    // therefore resolve to a different, visually bigger pixel size despite being
    // textually identical. Read the branch pill's own already-*computed* font
    // instead, so this always matches exactly regardless of either one's
    // ancestors.
    defaultBtn.style.font = window.getComputedStyle(branchElement).font;
    defaultBtn.style.backgroundColor = DEFAULT_BG_COLOR;
    defaultBtn.style.color = DEFAULT_TEXT_COLOR;
    defaultBtn.style.borderColor = DEFAULT_BG_COLOR;
    defaultBtn.onclick = () => {
        branchColors.delete(branchName);
        persistBranchColors();

        // Not scoped to just the PR list's own pills (".commit-ref...base-r") -
        // a branch name can also be shown as a read-only colorized pill inside
        // GitHub's own PR hovercard, a PR page's own header, or its timeline,
        // matched by "data-branch-name" alone. getStyleForElement() picks the
        // right style computation for whichever kind of element this is.
        const allBranchElements = document.querySelectorAll('[data-branch-name]');
        allBranchElements.forEach(element => {
            if (element.dataset.branchName === branchName) {
                element.setAttribute('style', getStyleForElement(element, branchName));
            }
        });

        bgPicker.value = DEFAULT_BG_COLOR;
        textPicker.value = DEFAULT_TEXT_COLOR;
    };

    const copyBtn = document.createElement('button');
    copyBtn.classList.add('icon-button');
    copyBtn.title = 'Copy branch name to clipboard';
    copyBtn.appendChild(createColorPickerIcon(COPY_ICON_PATHS));
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(branchName).then(() => {
            // Match GitHub's own copy-to-clipboard buttons (e.g. "copy full SHA"
            // on a commit): briefly swap the whole icon for a checkmark instead
            // of just changing a label, then swap it back.
            const copyIcon = copyBtn.firstChild;
            const checkIcon = createColorPickerIcon(CHECK_ICON_PATH, 'var(--fgColor-success, #1a7f37)');
            copyBtn.replaceChild(checkIcon, copyIcon);
            setTimeout(() => {
                copyBtn.replaceChild(copyIcon, checkIcon);
            }, 1200);
        });
    };

    const updateColors = () => {
        const bgColor = bgPicker.value;
        const textColor = textPicker.value;

        branchColors.set(branchName, {
            backgroundColor: bgColor,
            textColor: textColor
        });
        persistBranchColors();

        const allBranchElements = document.querySelectorAll('[data-branch-name]');
        allBranchElements.forEach(element => {
            if (element.dataset.branchName === branchName) {
                element.setAttribute('style', getStyleForElement(element, branchName, bgColor, textColor));
            }
        });
    };

    bgPicker.addEventListener('input', updateColors);
    textPicker.addEventListener('input', updateColors);

    const closeBtn = document.createElement('button');
    closeBtn.classList.add('icon-button');
    closeBtn.title = 'Close';
    closeBtn.appendChild(createColorPickerIcon(CLOSE_ICON_PATH));
    closeBtn.onclick = () => {
        cleanup();
    };

    popup.appendChild(defaultBtn);
    popup.appendChild(bgPicker);
    popup.appendChild(textPicker);
    popup.appendChild(copyBtn);
    popup.appendChild(closeBtn);

    document.body.appendChild(popup);

    const updatePosition = () => {
        const rect = branchElement.getBoundingClientRect();

        if (rect.top < 0 || rect.bottom > window.innerHeight ||
            rect.left < 0 || rect.right > window.innerWidth) {
            popup.style.display = 'none';
            return;
        }

        popup.style.display = 'flex';
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 4}px`;
    };

    updatePosition();

    document.addEventListener('scroll', updatePosition, true);

    const cleanup = () => {
        popup.remove();
        document.removeEventListener('scroll', updatePosition, true);
        document.removeEventListener('click', closeOnClickOutside);
    };

    const closeOnClickOutside = (e) => {
        if (!popup.contains(e.target) && e.target !== branchElement) {
            cleanup();
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeOnClickOutside);
    }, 100);
};
