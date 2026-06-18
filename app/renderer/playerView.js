const i18n = require('./i18n.js');

var events = {};
var lastFadeTime = 0;
var textBufferEl = null;
var instructionPrefix = null;
var animationEnabled = true;

document.addEventListener("keyup", function(){
    var player = document.getElementById("player");
    if (player) player.classList.remove("altKey");
});
document.addEventListener("keydown", function(){
    var player = document.getElementById("player");
    if (player) player.classList.add("altKey");
});

// Initial default: append to visible buffer
textBufferEl = document.querySelector("#player .innerText.active");

function shouldAnimate() {
    return textBufferEl && textBufferEl.classList.contains("active");
}

function showSessionView(sessionId) {
    var player = document.getElementById("player");
    if (!player) return;

    var hiddenContainer = player.querySelector(".hiddenBuffer");
    var hidden = hiddenContainer ? hiddenContainer.querySelector(".innerText") : null;
    var active = player.querySelector(".innerText.active");

    if (active && active._sessionId === sessionId) {
        return;
    }

    if (hidden && hidden._sessionId === sessionId && active && hiddenContainer) {
        // Swap buffers
        active.classList.remove("active");
        hiddenContainer.appendChild(active);
        hiddenContainer.parentElement.insertBefore(hidden, hiddenContainer);
        hidden.classList.add("active");

        // Also make this the active buffer
        textBufferEl = hidden;
    }
}

function fadeIn(element) {

    const minimumTimeSeparation = 200;
    const animDuration = 1000;

    var currentTime = Date.now();
    var timeSinceLastFade = currentTime - lastFadeTime;

    var delay = 0;
    if( timeSinceLastFade < minimumTimeSeparation )
        delay = minimumTimeSeparation - timeSinceLastFade;

    element.style.opacity = 0;
    element.style.transition = `opacity ${animDuration}ms ease-in-out`;
    
    setTimeout(() => {
        element.style.opacity = 1.0;
    }, delay);

    lastFadeTime = currentTime + delay;
}

function contentReady() {

    var scrollContainer = document.querySelector("#player .scrollContainer");
    if (!scrollContainer || !textBufferEl) return;

    // Need to save these ones because we are resetting height, so these are lost
    var savedScrollTop = scrollContainer.scrollTop;
    var prevHeight = textBufferEl.offsetHeight;

    // Need to reset first, otherwise scrollHeight doesn't calculate nicely
    textBufferEl.style.height = "0px";
    var newHeight = textBufferEl.scrollHeight;

    // Expand to fit or keep same
    if( prevHeight < newHeight ) {
        textBufferEl.style.height = newHeight + "px";
    } else {
        textBufferEl.style.height = prevHeight + "px";
    }

    // Scroll?
    if( shouldAnimate() ) {
        
        var offset = newHeight + 60 - scrollContainer.offsetHeight; // +60 because of padding

        // Restore scroll pos
        scrollContainer.scrollTop = savedScrollTop;

        scrollContainer.scrollTo({
            top: offset,
            behavior: animationEnabled ? 'smooth' : 'auto'
        });

        setTimeout(() => {
            // Shrink, if needed
            if( prevHeight > newHeight ) {
                textBufferEl.style.height = newHeight + "px";
            }
        }, animationEnabled ? 500 : 100);
    }
}

function prepareForNewPlaythrough(sessionId) {

    textBufferEl = document.querySelector("#player .hiddenBuffer .innerText");
    if (textBufferEl) {
        textBufferEl._sessionId = sessionId;
        textBufferEl.textContent = "";
        textBufferEl.style.height = "0px";
    }
}

function addTextSection(text)
{
    var paragraph = document.createElement("p");
    paragraph.className = 'storyText';

    // Game-specific instruction prefix, e.g. >>> START CAMERA: Wide shot
    if( instructionPrefix && text.trim().startsWith(instructionPrefix) ) {
        paragraph.classList.add("customInstruction");
    }

    // Split individual words into span tags, so that they can be underlined
    // when the user holds down the alt key, and so that they can be individually
    // clicked in order to jump to the source.
    var splitIntoSpans = text.split(" ");
    var textAsSpans = "<span>" + splitIntoSpans.join("</span> <span>") + "</span>";

    paragraph.innerHTML = textAsSpans;

    // Keep track of the offset of each word into the content
    var previousContentLength = 0;
    var storyTexts = Array.from(textBufferEl.children).filter(child => child.classList.contains("storyText"));
    var existingLastContent = storyTexts[storyTexts.length - 1];
    if( existingLastContent ) {
        var range = existingLastContent._range;
        if( range ) {
            previousContentLength = range.start + range.length + 1; // + 1 for newline
        }
    }
    paragraph._range = {start: previousContentLength, length: text.length};

    // Append the actual content
    textBufferEl.appendChild(paragraph);

    // Find the offset of each word in the content, for clickability
    var offset = previousContentLength;
    paragraph.querySelectorAll("span").forEach((span) => {
        var length = span.textContent.length;
        span._range = {start: offset, length: length};
        offset += length + 1; // extra 1 for space

        span.addEventListener("click", function(e) {
            if( e.altKey ) {
                var range = span._range;
                if( range ) {
                    var midOffset = Math.floor(range.start + range.length/2);
                    events.jumpToSource(midOffset);
                }
                e.preventDefault();
            }
        });
    });

    if( animationEnabled && shouldAnimate() )
        fadeIn(paragraph);
}

function addTags(tags)
{
    var tagsStr = tags.join(", ");
    var tagsEl = document.createElement("p");
    tagsEl.className = 'tags';
    tagsEl.textContent = `# ${tagsStr}`;

    textBufferEl.appendChild(tagsEl);

    if( animationEnabled && shouldAnimate() )
        fadeIn(tagsEl);
}

function addChoice(choice, callback)
{
    var choiceLink = document.createElement("a");
    choiceLink.href = "#";
    choiceLink.textContent = choice.choice.text;

    var tagsSpan = null;
    if( choice.choice.tags != null && choice.choice.tags.length > 0 ) {
        var tagsStr = "# " + choice.choice.tags.join(" # ");
        tagsSpan = document.createElement("span");
        tagsSpan.className = 'tags';
        tagsSpan.textContent = " " + tagsStr;
    }

    // Append the choice
    var choicePara = document.createElement("p");
    choicePara.className = 'choice';
    choicePara.appendChild(choiceLink);
    if( tagsSpan != null ) choicePara.appendChild(tagsSpan);
    textBufferEl.appendChild(choicePara);

    // Fade it in
    if( animationEnabled && shouldAnimate() )
        fadeIn(choicePara);

    // When this choice is clicked...
    choiceLink.addEventListener("click", (event) => {

        var existingHeight = textBufferEl.offsetHeight;
        textBufferEl.style.height = existingHeight + "px";

        // Remove any existing choices, and add a divider
        document.querySelectorAll(".choice").forEach(choiceEl => choiceEl.remove());

        addHorizontalDivider();

        event.preventDefault();

        callback();
    });
}

function addTerminatingMessage(message, cssClass)
{
    var messageEl = document.createElement("p");
    messageEl.className = cssClass;
    messageEl.textContent = message;
    textBufferEl.appendChild(messageEl);

    if( animationEnabled && shouldAnimate() )
        fadeIn(messageEl);
}

function addLongMessage(message, cssClass)
{
    var messageEl = document.createElement("pre");
    messageEl.className = cssClass;
    messageEl.textContent = message;
    textBufferEl.appendChild(messageEl);

    if( animationEnabled && shouldAnimate() )
        fadeIn(messageEl);
}

function addHorizontalDivider()
{
    if ((textBufferEl.lastChild == null) || (textBufferEl.lastChild.nodeName != "HR")) {
        var hr = document.createElement("hr");
        textBufferEl.appendChild(hr);
    }
}

function addLineError(error, callback)
{
    var aError = document.createElement("a");
    aError.href = "#";
    aError.textContent = `${i18n._("Line")} ${error.lineNumber}: ${error.message}`;
    aError.addEventListener("click", callback);

    var paragraph = document.createElement("p");
    paragraph.className = 'error';
    paragraph.appendChild(aError);
    textBufferEl.appendChild(paragraph);
}

function addEvaluationResult(result, error)
{   
    var resultEl = document.createElement("div");
    resultEl.className = "evaluationResult" + (error ? " error" : "");
    var span = document.createElement("span");
    span.textContent = error || result;
    resultEl.appendChild(span);
    textBufferEl.appendChild(resultEl);
}

function previewStepBack()
{
    var activeBuffer = document.querySelector("#player .innerText.active");
    if (!activeBuffer) return;

    var hrs = activeBuffer.querySelectorAll("hr");
    var lastDivider = hrs[hrs.length - 1];
    if (lastDivider) {
        var next = lastDivider.nextElementSibling;
        while (next) {
            var toRemove = next;
            next = next.nextElementSibling;
            toRemove.remove();
        }
        lastDivider.remove();
    }
}

function setInstructionPrefix(prefix) {
    if( instructionPrefix == prefix ) return;

    instructionPrefix = prefix;

    // Refresh any existing content
    let storyChunks = textBufferEl.querySelectorAll("p.storyText");
    for(let storyChunk of storyChunks) {
        storyChunk.classList.remove("customInstruction");

        if( storyChunk.textContent.trim().startsWith(instructionPrefix) ) {
            storyChunk.classList.add("customInstruction");
        }
    }
}

function setAnimationEnabled(animEnabled) {
    animationEnabled = animEnabled;
}

exports.PlayerView = {
    setEvents: (e) => { events = e; },
    contentReady: contentReady,
    prepareForNewPlaythrough: prepareForNewPlaythrough,
    addTextSection: addTextSection,
    addTags: addTags,
    addChoice: addChoice,
    addTerminatingMessage: addTerminatingMessage,
    addLongMessage: addLongMessage,
    addHorizontalDivider: addHorizontalDivider,
    addLineError: addLineError,
    addEvaluationResult: addEvaluationResult,
    showSessionView: showSessionView,
    previewStepBack: previewStepBack,
    setInstructionPrefix: setInstructionPrefix,
    setAnimationEnabled: setAnimationEnabled
};  