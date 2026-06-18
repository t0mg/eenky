const i18n = require("./i18n.js");

// Overriden by external setButtonActions call
var events = {
    rewind:   () => {},
    stepBack: () => {},
    selectIssue: () => {},
    didSetTitle: () => {}
};

function updateIssueSummary(issues, issueClickCallback) {

    var messageEl = document.querySelector(".issuesMessage");
    var summaryEl = document.querySelector(".issuesSummary");
    var issuesPopupEl = document.querySelector("#toolbar .issue-popup");
    var issuesTableEl = issuesPopupEl ? issuesPopupEl.querySelector(".table") : null;
    if (issuesTableEl) {
        issuesTableEl.innerHTML = "";
    }

    var errorCount = 0;
    var warningCount = 0;
    var todoCount = 0;

    var issuePriorties = {
        "ERROR": 1,
        "RUNTIME ERROR": 2,
        "WARNING": 3,
        "RUNTIME WARNING": 4,
        "TODO": 5
    };

    issues.sort((i1, i2) => {
        var errorTypeDiff = issuePriorties[i1.type] - issuePriorties[i2.type];
        if( errorTypeDiff != 0 )
            return errorTypeDiff;
        else
            return i1.lineNumber - i2.lineNumber;
    });

    issues.forEach((issue) => {
        var errorClass = "";
        if( issue.type == "ERROR" || issue.type == "RUNTIME ERROR" ) {
            errorCount++;
            errorClass = "error";
        } else if( issue.type == "WARNING" ) {
            warningCount++;
            errorClass = "warning";
        } else if( issue.type == "TODO" ) {
            todoCount++;
            errorClass = "todo";
        }

        var row = document.createElement("div");
        row.className = `row ${errorClass}`;
        row.innerHTML = `
            <div class="col line-no">
              ${issue.lineNumber}
            </div>
            <div class="col issue">
              ${issue.message}
            </div>
            <span class="icon icon-right-open-big"></span>
        `;

        row.addEventListener("click", (e) => {
            events.selectIssue(issue);
            e.preventDefault();
        });

        if (issuesTableEl) {
            issuesTableEl.appendChild(row);
        }
    });

    if (summaryEl && messageEl) {
        if( errorCount == 0 && warningCount == 0 && todoCount == 0 ) {
            summaryEl.classList.add("hidden");
            messageEl.textContent = i18n._("No issues.");
            messageEl.classList.remove("hidden");
            if (issuesPopupEl) {
                issuesPopupEl.classList.add("hidden");
            }
        } else {
            messageEl.classList.add("hidden");
            function updateCount(className, count) {
                var issueCountEl = summaryEl.querySelector(".issueCount."+className);
                if (issueCountEl) {
                    if( count == 0 ) {
                        issueCountEl.style.display = "none";
                    } else {
                        issueCountEl.style.display = "inline-block";
                        var span = issueCountEl.querySelector("span");
                        if (span) span.textContent = count;
                    }
                }
            }

            updateCount("error", errorCount);
            updateCount("warning", warningCount);
            updateCount("todo", todoCount);
            summaryEl.classList.remove("hidden");

            updateIssuesPopupPosition();
        }
    }
}

function updateIssuesPopupPosition() {
    var issuesPopupEl = document.querySelector("#toolbar .issue-popup");
    if (issuesPopupEl) {
        var width = window.innerWidth;
        var popupWidth = issuesPopupEl.offsetWidth;
        issuesPopupEl.style.left = (0.5 * width - 0.5 * popupWidth) + "px";
    }
}

window.addEventListener("DOMContentLoaded", function() {

    var navToggle = document.querySelector("#toolbar .nav-toggle");
    if (navToggle) {
        navToggle.addEventListener("click", function(event) {
            events.toggleSidebar("#file-nav-wrapper", ".nav-toggle");
            event.preventDefault();
        });
    }

    var knotToggle = document.querySelector("#toolbar .knot-toggle");
    if (knotToggle) {
        knotToggle.addEventListener("click", function(event) {
            events.toggleSidebar("#knot-stitch-wrapper", ".knot-toggle");
            event.preventDefault();
        });
    }

    var navBack = document.querySelector("#toolbar .nav-back");
    if (navBack) {
        navBack.addEventListener("click", function(event) {
            events.navigateBack();
            event.preventDefault();
        });
    }

    var navForward = document.querySelector("#toolbar .nav-forward");
    if (navForward) {
        navForward.addEventListener("click", function(event) {
            events.navigateForward();
            event.preventDefault();
        });
    }

    var rewindBtn = document.querySelector("#toolbar .rewind");
    if (rewindBtn) {
        rewindBtn.addEventListener("click", function(event) {
            events.rewind();
            event.preventDefault();
        });
    }

    var stepBackBtn = document.querySelector("#toolbar .step-back");
    if (stepBackBtn) {
        stepBackBtn.addEventListener("click", function(event) {
            events.stepBack();
            event.preventDefault();
        });
    }

    var popup = document.querySelector("#toolbar .issue-popup");
    var summary = document.querySelector("#toolbar .issuesSummary");
    var shouldBeHidden = false;
    var timeoutId = null;

    function showPopup() {
        if (popup) popup.classList.remove("hidden");
        shouldBeHidden = false;
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    }

    function hidePopup() {
        shouldBeHidden = true;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            if (shouldBeHidden && popup) {
                popup.classList.add("hidden");
            }
        }, 500);
    }

    if (summary) {
        summary.addEventListener("mouseenter", showPopup);
        summary.addEventListener("mouseleave", hidePopup);
    }
    if (popup) {
        popup.addEventListener("mouseenter", showPopup);
        popup.addEventListener("mouseleave", hidePopup);
    }

    window.addEventListener("resize", updateIssuesPopupPosition);
});

function setTitle(title) {
    var titleEl = document.querySelector("h1.title");
    if (titleEl) {
        titleEl.textContent = title;
    }
    events.didSetTitle(title);
}

function setBusySpinnerVisible(vis) {
    var spinner = document.querySelector(".busySpinner");
    if (spinner) {
        spinner.style.display = vis ? "block" : "none";
    }
}

exports.ToolbarView = {
    setEvents: (e) => { events = e; },
    updateIssueSummary: updateIssueSummary,
    clearIssueSummary: () => { updateIssueSummary([]); },
    setTitle: setTitle,
    setBusySpinnerVisible: setBusySpinnerVisible
}