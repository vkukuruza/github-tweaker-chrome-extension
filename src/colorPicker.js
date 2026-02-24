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
        
        .color-picker-popup input[type="color"] {
            cursor: pointer;
            border: 1px solid var(--borderColor-default, var(--color-border-default));
            border-radius: 4px;
            width: 24px;
            height: 24px;
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
            padding: 4px 8px;
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
    `;
    document.head.appendChild(style);
};

window.openBranchColorPicker = function (branchElement, branchName, branchColors, getBranchColorStyle, persistBranchColors) {
    const existingPicker = document.querySelector('.color-picker-popup');
    if (existingPicker) {
        existingPicker.remove();
    }

    const currentBgColor = branchColors.get(branchName)?.backgroundColor || '#ddf4ff';
    const currentTextColor = branchColors.get(branchName)?.textColor || '#656d76';

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

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.onclick = () => {
        popup.remove();
        document.removeEventListener('scroll', updatePosition, true);
    };

    const defaultBtn = document.createElement('button');
    defaultBtn.textContent = 'Default';
    defaultBtn.onclick = () => {
        branchColors.delete(branchName);
        persistBranchColors();

        const allBranchElements = document.querySelectorAll('.commit-ref.css-truncate.css-truncate-target.user-select-contain.base-r');
        allBranchElements.forEach(element => {
            if (element.dataset.branchName === branchName) {
                element.setAttribute('style', getBranchColorStyle(branchName));
            }
        });

        bgPicker.value = '#ddf4ff';
        textPicker.value = '#656d76';
    };

    const updateColors = () => {
        const bgColor = bgPicker.value;
        const textColor = textPicker.value;

        branchColors.set(branchName, {
            backgroundColor: bgColor,
            textColor: textColor
        });
        persistBranchColors();

        const allBranchElements = document.querySelectorAll('.commit-ref.css-truncate.css-truncate-target.user-select-contain.base-r');
        allBranchElements.forEach(element => {
            if (element.dataset.branchName === branchName) {
                element.setAttribute('style', getBranchColorStyle(branchName, bgColor, textColor));
            }
        });
    };

    bgPicker.addEventListener('input', updateColors);
    textPicker.addEventListener('input', updateColors);

    popup.appendChild(bgPicker);
    popup.appendChild(textPicker);
    popup.appendChild(closeBtn);
    popup.appendChild(defaultBtn);
    document.body.appendChild(popup);

    const updatePosition = () => {
        const rect = branchElement.getBoundingClientRect();

        if (rect.top < 0 || rect.bottom > window.innerHeight ||
            rect.left < 0 || rect.right > window.innerWidth) {
            popup.style.display = 'none';
        } else {
            popup.style.display = 'flex';
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 4}px`;
        }
    };

    updatePosition();

    document.addEventListener('scroll', updatePosition, true);

    const closeOnClickOutside = (e) => {
        if (!popup.contains(e.target) && e.target !== branchElement) {
            popup.remove();
            document.removeEventListener('scroll', updatePosition, true);
            document.removeEventListener('click', closeOnClickOutside);
        }
    };

    setTimeout(() => {
        document.addEventListener('click', closeOnClickOutside);
    }, 100);
};
