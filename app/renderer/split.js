const editor = ace.edit("editor");

const widthLimit = 100;

window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll(".split").forEach(splitEl => {
        var leftEl = splitEl.previousElementSibling;
        var rightEl = splitEl.nextElementSibling;
        var parentEl = splitEl.parentElement;

        var gripEl = document.createElement("div");
        gripEl.className = "grip";
        splitEl.appendChild(gripEl);

        var isDragging = false;

        gripEl.addEventListener("mousedown", (event) => {
            isDragging = true;
            event.preventDefault();
        });

        document.addEventListener("mousemove", (event) => {
            if (isDragging) {
                var x0 = parentEl.getBoundingClientRect().left;
                var x = event.pageX - x0;
                var width = parentEl.clientWidth;

                if (x < widthLimit)
                    x = widthLimit;
                if (x > width - widthLimit)
                    x = width - widthLimit;

                var percent = 100 * (x / width);
                var fromLeft = percent + "%";
                var fromRight = (100 - percent) + "%";

                if (leftEl) {
                    leftEl.style.right = fromRight;
                    leftEl.style.width = fromLeft;
                }
                if (rightEl) {
                    rightEl.style.left = fromLeft;
                    rightEl.style.width = fromRight;
                }
                splitEl.style.left = fromLeft;

                // Hack... not sure of a better way to do this
                // (always resize editor since both the centre split
                // and the sidebar split will affect it)
                editor.resize();

                event.preventDefault();
            }
        });

        document.addEventListener("mouseup", (event) => {
            if (isDragging) {
                isDragging = false;
                event.preventDefault();
            }
        });
    });
});