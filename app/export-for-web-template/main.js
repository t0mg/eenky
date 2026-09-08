(function(storyContent) {


    // Create ink story from the content using inkjs
    var story = new inkjs.Story(storyContent);

    var savePoint = "";

    const SAVE_INDEX_KEY = document.title + "story-save-index";

    function makeSafeSaveId(text) {
        return text
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function getAllSaves() {
        try {
            return JSON.parse(localStorage.getItem(SAVE_INDEX_KEY) || "[]");
        } catch {
            return [];
        }
    }

    function saveCheckpoint(title) {
        try {
            const safeId = makeSafeSaveId(title);

            const visibleTitle = title
                .trim()
                .replace(/^___(.*)___$/, "$1")
                .replace(/^__(.*)__$/, "$1")
                .replace(/^_(.*)_$/, "$1");

            const saveData = {
                id: safeId,
                title: visibleTitle,
                state: savePoint,
                timestamp: Date.now()
            };

            localStorage.setItem(
                `story-save-${safeId}`,
                JSON.stringify(saveData)
            );

            let saves = getAllSaves();

            // remove duplicate entry if it already exists
            saves = saves.filter(s => s.id !== safeId);

            saves.push({
                id: safeId,
                title: visibleTitle,
                timestamp: saveData.timestamp
            });

            localStorage.setItem(
                SAVE_INDEX_KEY,
                JSON.stringify(saves)
            );

            document.getElementById("reload")?.removeAttribute("disabled");
        } catch (e) {
            console.warn("Couldn't create checkpoint", e);
        }
    }

   function loadCheckpoint(id) {
        try {
            const raw = localStorage.getItem(`story-save-${id}`);
            if (!raw) return false;

            const save = JSON.parse(raw);

            // Remove any checkpoints created after this one
            let saves = getAllSaves();

            saves.forEach(s => {
                if (s.timestamp > save.timestamp) {
                    localStorage.removeItem(`story-save-${s.id}`);
                }
            });

            saves = saves.filter(s => s.timestamp <= save.timestamp);

            localStorage.setItem(
                SAVE_INDEX_KEY,
                JSON.stringify(saves)
            );

            // Disable load button if somehow no saves remain
            const reloadEl = document.getElementById("reload");
            if (reloadEl && saves.length === 0) {
                reloadEl.setAttribute("disabled", "disabled");
            }

            removeAll("p");
            removeAll("img");
            removeAll("hr");

            story.state.LoadJson(save.state);

            continueStory(true);

            return true;

        } catch (e) {
            console.warn("Couldn't load checkpoint", e);
            return false;
        }
    }

    document.body.classList.toggle("dark");

    // Global tags - those at the top of the ink file
    // We support:
    //  # theme: dark
    //  # author: Your Name
    var globalTags = story.globalTags;
    if( globalTags ) {
        for(var i=0; i<story.globalTags.length; i++) {
            var globalTag = story.globalTags[i];
            var splitTag = splitPropertyTag(globalTag);

            // THEME: dark
            if( splitTag && splitTag.property == "theme" ) {
                globalTagTheme = splitTag.val;
            }

            // author: Your Name
            else if( splitTag && splitTag.property == "author" ) {
                var byline = document.querySelector('.byline');
                byline.innerHTML = "by "+splitTag.val;
            }
        }
    }

    var storyContainer = document.querySelector('#story');
    var outerScrollContainer = document.querySelector('.outerContainer');

    // page features setup
    
    var hasSave = getAllSaves().length > 0;
    setupButtons(hasSave);

    // Set initial save point
savePoint = story.state.toJson();

// Auto-load most recent checkpoint if one exists
const existingSaves = getAllSaves();

if (existingSaves.length > 0) {
    const latestSave = existingSaves.reduce((latest, current) =>
        current.timestamp > latest.timestamp ? current : latest
    );

    loadCheckpoint(latestSave.id);
} else {
    // No save found, start from the beginning
    continueStory(true);
}

    // Main story processing function. Each time this is called it generates
    // all the next content up as far as the next set of choices.
    function continueStory(firstTime) {

        var paragraphIndex = 0;
        var delay = 0.0;

        // Don't over-scroll past new content
        var previousBottomEdge = firstTime ? 0 : contentBottomEdgeY();

        var firstLineVisible = false;

        // Generate story text - loop through available content
        while(story.canContinue) {

            // Get ink to generate the next paragraph
            var paragraphText = story.Continue();
            var tags = story.currentTags;

            // Any special tags included with this line
            var customClasses = [];
            for(var i=0; i<tags.length; i++) {
                var tag = tags[i];

                // Detect tags of the form "X: Y". Currently used for IMAGE and CLASS but could be
                // customised to be used for other things too.
                var splitTag = splitPropertyTag(tag);
				splitTag.property = splitTag.property.toUpperCase();

                // AUDIO: src
                if( splitTag && splitTag.property == "AUDIO" ) {
                  if('audio' in this) {
                    this.audio.pause();
                    this.audio.removeAttribute('src');
                    this.audio.load();
                  }
                  this.audio = new Audio(splitTag.val);
                  this.audio.play();
                }

                // AUDIOLOOP: src
                else if( splitTag && splitTag.property == "AUDIOLOOP" ) {
                  if('audioLoop' in this) {
                    this.audioLoop.pause();
                    this.audioLoop.removeAttribute('src');
                    this.audioLoop.load();
                  }
                  this.audioLoop = new Audio(splitTag.val);
                  this.audioLoop.play();
                  this.audioLoop.loop = true;
                }

                // IMAGE: src
                if( splitTag && splitTag.property == "IMAGE" ) {
                    var imageElement = document.createElement('img');
                    imageElement.src = splitTag.val;
                    storyContainer.appendChild(imageElement);

                    imageElement.onload = () => {
                        console.log(`scrollingto ${previousBottomEdge}`)
                        scrollDown(previousBottomEdge)
                    }

                    showAfter(delay, imageElement);
                    delay += 200.0;
                }

                // LINK: url
                else if( splitTag && splitTag.property == "LINK" ) {
                    window.location.href = splitTag.val;
                }

                // LINKOPEN: url
                else if( splitTag && splitTag.property == "LINKOPEN" ) {
                    window.open(splitTag.val);
                }

                // BACKGROUND: src
                else if( splitTag && splitTag.property == "BACKGROUND" ) {
                    outerScrollContainer.style.backgroundImage = 'url('+splitTag.val+')';
                }

                else if ( splitTag && splitTag.property == "CHECKPOINT" && splitTag.val) {
                    saveCheckpoint(splitTag.val.trim());
                    
                }

                // CLASS: className
                else if( splitTag && splitTag.property == "CLASS" ) {
                    customClasses.push(splitTag.val);
                    if (splitTag.val == 'centered' && !firstLineVisible) {


                        removeAll("p");
                        removeAll("hr");
                        removeAll("img");
                    }
                }

                // CLEAR - removes all existing content.
                // RESTART - clears everything and restarts the story from the beginning
                else if( tag == "CLEAR" || tag == "RESTART" ) {
                    removeAll("p");
                    removeAll("hr");
                    removeAll("img");

                    // Comment out this line if you want to leave the header visible when clearing
                    setVisible(".header", false);

                    if( tag == "RESTART" ) {
                        restart();
                        return;
                    }
                }
            }
		
		// Check if paragraphText is empty
		if (paragraphText.trim().length == 0) {
                continue; // Skip empty paragraphs
		}

        firstLineVisible = true;

        let html = paragraphText
          // ___text___ => <strong><em>text</em></strong>
          .replace(/___(.*?)___/g, '<strong><em>$1</em></strong>')
          // __text__ => <strong>text</strong>
          .replace(/__(.*?)__/g, '<strong>$1</strong>')
          // _text_ => <em>text</em>
          .replace(/_(.*?)_/g, '<em>$1</em>');

            // Create paragraph element (initially hidden)
            var paragraphElement = document.createElement('p');
            paragraphElement.innerHTML = html;
            storyContainer.appendChild(paragraphElement);



            // Add any custom classes derived from ink tags
            for(var i=0; i<customClasses.length; i++)
                paragraphElement.classList.add(customClasses[i]);

            // Fade in paragraph after a short delay
            showAfter(delay, paragraphElement);
            delay += 200.0;
        }

        // Create HTML choices from ink choices
        story.currentChoices.forEach(function(choice) {

            // Create paragraph with anchor element
            var choiceTags = choice.tags;
            var customClasses = [];
            var isClickable = true;
            for(var i=0; i<choiceTags.length; i++) {
                var choiceTag = choiceTags[i];
                var splitTag = splitPropertyTag(choiceTag);
				splitTag.property = splitTag.property.toUpperCase();

                if(choiceTag.toUpperCase() == "UNCLICKABLE"){
                    isClickable = false
                }

                if( splitTag && splitTag.property == "CLASS" ) {
                    customClasses.push(splitTag.val);
                }

            }

            
            var choiceParagraphElement = document.createElement('p');
            choiceParagraphElement.classList.add("choice");

            for(var i=0; i<customClasses.length; i++)
                choiceParagraphElement.classList.add(customClasses[i]);

            let html = choice.text
          // ___text___ => <strong><em>text</em></strong>
          .replace(/___(.*?)___/g, '<strong><em>$1</em></strong>')
          // _text_ => <em>text</em>
          .replace(/_(.*?)_/g, '<em>$1</em>');


            if(isClickable){
                choiceParagraphElement.innerHTML = `<a href='#'>${html}</a>`
            }else{
                choiceParagraphElement.innerHTML = `<span class='unclickable'>${html}</span>`
            }
            storyContainer.appendChild(choiceParagraphElement);

            // Fade choice in after a short delay
            showAfter(delay, choiceParagraphElement);
            delay += 200.0;

            // Click on choice
            if(isClickable){
                var choiceAnchorEl = choiceParagraphElement.querySelectorAll("a")[0];
                choiceAnchorEl.addEventListener("click", function(event) {

                    // Don't follow <a> link
                    event.preventDefault();

                    // Extend height to fit
                    // We do this manually so that removing elements and creating new ones doesn't
                    // cause the height (and therefore scroll) to jump backwards temporarily.
                    storyContainer.style.height = contentBottomEdgeY()+"px";

                    // Remove all existing choices
                    removeAll(".choice");

                    var lineElement = document.createElement('hr');
                    storyContainer.appendChild(lineElement);

                    // Tell the story where to go next
                    story.ChooseChoiceIndex(choice.index);

                    // This is where the save button will save from
                    savePoint = story.state.toJson();

                    // Aaand loop
                    continueStory();
                });
            }
        });

		// Unset storyContainer's height, allowing it to resize itself
		storyContainer.style.height = "";

        if( !firstTime )
            scrollDown(previousBottomEdge);

    }

   function restart() {

        // Delete all checkpoint saves
        try {
            const saves = getAllSaves();

            saves.forEach(save => {
                localStorage.removeItem(`story-save-${save.id}`);
            });

            localStorage.removeItem(SAVE_INDEX_KEY);

            const reloadEl = document.getElementById("reload");
            if (reloadEl) {
                reloadEl.setAttribute("disabled", "disabled");
            }

        } catch (e) {
            console.warn("Couldn't clear saves", e);
        }

        story.ResetState();

        setVisible(".header", true);

        savePoint = story.state.toJson();

        continueStory(true);

        outerScrollContainer.scrollTo(0, 0);
    }
    // -----------------------------------
    // Various Helper functions
    // -----------------------------------

    // Detects whether the user accepts animations
    function isAnimationEnabled() {
        return window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    }

    // Fades in an element after a specified delay
    function showAfter(delay, el) {
        if( isAnimationEnabled() ) {
            el.classList.add("hide");
            setTimeout(function() { el.classList.remove("hide") }, delay);
        } else {
            // If the user doesn't want animations, show immediately
            el.classList.remove("hide");
        }
    }

    // Scrolls the page down, but no further than the bottom edge of what you could
    // see previously, so it doesn't go too far.
    function scrollDown(previousBottomEdge) {
        // If the user doesn't want animations, let them scroll manually
        if ( !isAnimationEnabled() ) {
            return;
        }

        // Line up top of screen with the bottom of where the previous content ended
        var target = previousBottomEdge;

        // Can't go further than the very bottom of the page
        var limit = outerScrollContainer.scrollHeight - outerScrollContainer.clientHeight;
        if( target > limit ) target = limit;

        var start = outerScrollContainer.scrollTop;

        var dist = target - start;
        var duration = 300 + 300*dist/100;
        var startTime = null;
        function step(time) {
            if( startTime == null ) startTime = time;
            var t = (time-startTime) / duration;
            var lerp = 3*t*t - 2*t*t*t; // ease in/out
            outerScrollContainer.scrollTo(0, (1.0-lerp)*start + lerp*target);
            if( t < 1 ) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    // The Y coordinate of the bottom end of all the story content, used
    // for growing the container, and deciding how far to scroll.
    function contentBottomEdgeY() {
        var bottomElement = storyContainer.lastElementChild;
        return bottomElement ? bottomElement.offsetTop + bottomElement.offsetHeight : 0;
    }

    // Remove all elements that match the given selector. Used for removing choices after
    // you've picked one, as well as for the CLEAR and RESTART tags.
    function removeAll(selector)
    {
        var allElements = storyContainer.querySelectorAll(selector);
        for(var i=0; i<allElements.length; i++) {
            var el = allElements[i];
            el.parentNode.removeChild(el);
        }
    }

    // Used for hiding and showing the header when you CLEAR or RESTART the story respectively.
    function setVisible(selector, visible)
    {
        var allElements = storyContainer.querySelectorAll(selector);
        for(var i=0; i<allElements.length; i++) {
            var el = allElements[i];
            if( !visible )
                el.classList.add("invisible");
            else
                el.classList.remove("invisible");
        }
    }

    // Helper for parsing out tags of the form:
    //  # PROPERTY: value
    // e.g. IMAGE: source path
    function splitPropertyTag(tag) {
        var propertySplitIdx = tag.indexOf(":");
        if( propertySplitIdx != null ) {
            var property = tag.substr(0, propertySplitIdx).trim();
            var val = tag.substr(propertySplitIdx+1).trim();
            return {
                property: property,
                val: val
            };
        }

        return null;
    }

    

    function closeSaveModal() {
    const modal = document.getElementById("save-select-modal");
    if (modal) modal.remove();
}

    function showSaveModal() {

        const saves = getAllSaves();

        const overlay = document.createElement("div");
        overlay.id = "save-select-modal";

        overlay.style.position = "fixed";
        overlay.style.left = "0";
        overlay.style.top = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.background = "rgba(0,0,0,0.5)";
        overlay.style.zIndex = "9999";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";

        const panel = document.createElement("div");

        panel.style.background = "white";
        panel.style.padding = "20px";
        panel.style.maxHeight = "70vh";
        panel.style.overflowY = "auto";
        panel.style.minWidth = "300px";

        const heading = document.createElement("h3");
        heading.textContent = "Rewind Story...";
        panel.appendChild(heading);

        saves
            .sort((a, b) => a.timestamp - b.timestamp)
            .forEach(save => {

                const btn = document.createElement("button");

                btn.textContent = save.title;
                btn.style.fontWeight = "bold";

                btn.style.display = "block";
                btn.style.width = "100%";
                btn.style.marginBottom = "8px";

                btn.addEventListener("click", () => {
                    closeSaveModal();
                    loadCheckpoint(save.id);
                });

                panel.appendChild(btn);
            });

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Resume";

        cancelBtn.addEventListener("click", closeSaveModal);

        panel.appendChild(cancelBtn);

        overlay.appendChild(panel);

        overlay.addEventListener("click", e => {
            if (e.target === overlay) {
                closeSaveModal();
            }
        });

        document.body.appendChild(overlay);
    }

    // Used to hook up the functionality for global functionality buttons
    function setupButtons(hasSave) {

        let rewindEl = document.getElementById("rewind");
        if (rewindEl) rewindEl.addEventListener("click", function(event) {
            removeAll("p");
            removeAll("img");
            setVisible(".header", false);
            restart();
        });

        

        let reloadEl = document.getElementById("reload");
        if (!hasSave) {
            reloadEl.setAttribute("disabled", "disabled");
        }
        reloadEl.addEventListener("click", function(event) {

            const saves = getAllSaves();

            if (!saves.length)
                return;

            showSaveModal();
        });

        
        
    }

})(storyContent);
