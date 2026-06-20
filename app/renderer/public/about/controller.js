const electron = require("electron");
const ipc = electron.ipcRenderer;

ipc.on("set-about-data", (event, data) => {
    document.getElementById("version-inky").textContent = "Inky version: " + data.inkyVersion;
    document.getElementById("version-ink").textContent = "ink version: " + data.inkVersion;
    document.getElementById("version-inkjs").textContent = "inkjs version: " + data.inkjsVersion;
});

function updateTheme(event, newTheme) {
    let themes = ["dark", "contrast", "focus"];
    themes = themes.filter(e => e !== newTheme);
    if (newTheme && newTheme.toLowerCase() !== 'main') {
        document.body.classList.add(newTheme);
    }
    for (const theme of themes) {
        document.body.classList.remove(theme);
    }
}

updateTheme(null, window.localStorage.getItem("theme"));
ipc.on("change-theme", updateTheme);
