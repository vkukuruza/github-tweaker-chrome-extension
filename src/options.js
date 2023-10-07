let table = document.getElementById("branchColorsTable");
let branchCount = 0;

chrome.storage.local.get(['branchColors'], function (items) {
    if (Object.keys(items).length > 0) {
        let branchColorsJSON = Object.entries(JSON.parse(items.branchColors))
        let branchColors = new Map(branchColorsJSON);
        branchColors.forEach(function (value, key, map) {
            let branchName = key;
            let backgroundColor = map.get(key).backgroundColor;
            let textColor = map.get(key).textColor;
            branchCount++;

            addBranchRow(branchName, backgroundColor, textColor, branchCount);
        });
    }

    insertAddColorRow();
});

function addBranchRow(branchName, backgroundColor, textColor, index) {
    let newRow = table.insertRow(index);
    newRow.setAttribute('id', branchName);

    addBranchNameCell(newRow, createBranchSpanElement(branchName, backgroundColor, textColor));
    addBackgroundColorCell(newRow, branchName, backgroundColor);
    addTextColorCell(newRow, branchName, textColor);
    addRemoveButtonCell(newRow, branchName);
}

function addBranchNameCell(newRow, branchSpanElement) {
    let branchNameCell = newRow.insertCell(0);
    branchNameCell.setAttribute('class', 'branchNameColumn');
    branchNameCell.appendChild(branchSpanElement);
}

function createBranchSpanElement(branchName, backgroundColor, textColor) {
    let branchSpanElement = document.createElement("span");
    branchSpanElement.setAttribute("title", branchName);
    branchSpanElement.setAttribute("style", getBranchColorStyle(backgroundColor, textColor));
    branchSpanElement.appendChild(document.createTextNode(branchName));

    return branchSpanElement;
}

function getBranchColorStyle(backgroundColor, textColor) {
    return "background-color: " + backgroundColor + "; color: " + textColor + ";";
}

function addBackgroundColorCell(newRow, branchName, backgroundColor) {
    let backgroundColorCell = newRow.insertCell(1);
    backgroundColorCell.setAttribute('class', 'colorColumn');
    let backgroundColorInput = document.createElement("input");
    backgroundColorInput.setAttribute('type', 'color');
    backgroundColorInput.setAttribute('value', backgroundColor);
    backgroundColorInput.oninput = function () {
        changeColorInputValue(this);
        updateBranchColors(branchName);
        save();
    };
    backgroundColorCell.appendChild(backgroundColorInput);
}

function changeColorInputValue(element) {
    element.setAttribute('value', element.value);
}

function updateBranchColors(branchName) {
    let backgroundColor = document.getElementById(branchName).children[1].children[0].value;
    let textColor = document.getElementById(branchName).children[2].children[0].value;
    let branchSpanElement = document.getElementById(branchName).children[0].children[0];
    branchSpanElement.setAttribute('style', getBranchColorStyle(backgroundColor, textColor));
}

function addTextColorCell(newRow, branchName, textColor) {
    let textColorCell = newRow.insertCell(2);
    textColorCell.setAttribute('class', 'colorColumn');
    let textColorInput = document.createElement("input");
    textColorInput.setAttribute('type', 'color');
    textColorInput.setAttribute('value', textColor);
    textColorInput.oninput = function () {
        changeColorInputValue(this);
        updateBranchColors(branchName);
        save();
    };
    textColorCell.appendChild(textColorInput);
}

function addRemoveButtonCell(newRow, branchName) {
    let removeButtonCell = newRow.insertCell(3);
    removeButtonCell.setAttribute('class', 'buttonColumn');
    let removeButton = document.createElement("a");
    removeButton.innerText = 'remove'
    removeButton.dataset.branchName = branchName;
    removeButton.onclick = function () {
        removeBranchRow(this.dataset.branchName)
    };
    removeButtonCell.appendChild(removeButton);
}

function removeBranchRow(branchName) {
    document.getElementById(branchName).remove();

    if (branchName === document.getElementById('addColor').children[0].children[0].value.trim()) {
        document.getElementById('addColor').children[1].innerText = null;
    }

    branchCount--;
    save();
}

function insertAddColorRow() {
    let newRow = table.insertRow(branchCount + 1);
    newRow.setAttribute('id', 'addColor');

    addBranchNameInputCell(newRow);
    addErrorSpaceCell(newRow);
    addAddButtonCell(newRow);
}

function addBranchNameInputCell(newRow) {
    let branchNameCell = newRow.insertCell(0);
    branchNameCell.setAttribute('class', 'branchNameColumn');
    let branchNameInput = document.createElement("input");
    branchNameInput.setAttribute('type', 'text');
    branchNameInput.setAttribute('placeholder', 'add new branch');
    branchNameInput.oninput = function () {
        document.getElementById('addColor').children[1].innerText = null;
    };
    branchNameCell.appendChild(branchNameInput);
}

function addErrorSpaceCell(newRow) {
    let errorSpace = newRow.insertCell(1);
    errorSpace.setAttribute('colspan', '2');
    errorSpace.setAttribute('class', 'errorCell');
}

function addAddButtonCell(newRow) {
    let addButtonCell = newRow.insertCell(2);
    addButtonCell.setAttribute('class', 'buttonColumn');
    let addButton = document.createElement("a");
    addButton.innerText = 'add';
    addButton.onclick = onclickAddButton;
    addButtonCell.appendChild(addButton);
}

function onclickAddButton() {
    let value = document.getElementById('addColor').children[0].children[0].value.trim();

    if (value) {
        if (document.getElementById(value)) {
            document.getElementById('addColor').children[1].innerText = 'branch already exists';
        } else {
            document.getElementById('addColor').children[0].children[0].value = null;
            document.getElementById('addColor').children[1].innerText = null;
            addBranchRow(value, "#ddf4ff", "#656d76", branchCount + 1);
            branchCount++;
            save();
        }
    }
}

function save() {
    let branchColors = new Map;
    let rows = document.getElementById("branchColorsTable").rows;

    for (let i = 1; i < rows.length - 1; i++) {
        let branchName = rows[i].children[0].innerText;
        let backgroundColor = rows[i].children[1].children[0].value;
        let textColor = rows[i].children[2].children[0].value;
        branchColors.set(
            branchName,
            {
                backgroundColor: backgroundColor,
                textColor: textColor
            }
        );
    }

    let branchColorsJSON = JSON.stringify(Object.fromEntries(branchColors));
    chrome.storage.local.set({"branchColors": branchColorsJSON}).then(() => {
    });
}
