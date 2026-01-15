document.addEventListener("DOMContentLoaded", () => {

    // --- 1. Theme Handling ---
    const themeToggleBtn = document.getElementById("theme-toggle");
    const themeIcon = themeToggleBtn.querySelector("i");

    const setTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    };

    const currentTheme = localStorage.getItem('theme');
    if (currentTheme) setTheme(currentTheme);

    themeToggleBtn.addEventListener("click", () => {
        let theme = document.documentElement.getAttribute('data-theme');
        setTheme(theme === 'dark' ? 'light' : 'dark');
    });

    // --- 2. Get Post ID from URL ---
    const params = new URLSearchParams(window.location.search);
    const postId = params.get("id");

    const loader = document.getElementById("loader");
    const articleView = document.getElementById("article-view");

    if (!postId) {
        window.location.href = "index.html";
        return;
    }

    // --- 3. Fetch Specific Post ---
    const postRef = database.ref('blogPosts/' + postId);
    const viewCounterRef = database.ref('postViews/' + postId);

    postRef.once('value').then((snapshot) => {
        const post = snapshot.val();

        if (post) {
            viewCounterRef.transaction((currentViews) => {
                return (currentViews || 0) + 1;
            });

            renderFullPost(post);
            loadRelatedPosts(post.category, postId);
        } else {
            loader.style.display = "none";
            document.querySelector('main').innerHTML =
                "<h2 style='text-align:center; margin-top:50px'>Gist not found!</h2>";
        }
    }).catch((error) => {
        console.error("Error fetching gist:", error);
        loader.style.display = "none";
        document.querySelector('main').innerHTML =
            "<h2 style='text-align:center; margin-top:50px'>Error loading content.</h2>";
    });

    // --- 4. Render Full Post ---
    function renderFullPost(post) {
        document.title = `${post.title} | GistNova`;

        // --- Dynamic Open Graph Tags ---
        const postUrl = window.location.href;
        const defaultOgImage = 'https://via.placeholder.com/1200x630?text=GistNova+Read+Now';
        const imageUrl = post.img && post.img.trim() !== '' ? post.img : defaultOgImage;

        document.getElementById("og-title").content = post.title;
        document.getElementById("og-description").content = post.description;
        document.getElementById("og-image").content = imageUrl;
        document.getElementById("og-url").content = postUrl;

        document.getElementById("gist-title").textContent = post.title;
        document.getElementById("gist-category").textContent = post.category || "General";

        const dateObj = new Date(parseInt(post.timestamp) || Date.now());
        document.getElementById("gist-date").textContent = dateObj.toLocaleDateString(
            'en-US',
            { year: 'numeric', month: 'long', day: 'numeric' }
        );

        // Image handling
        const imgEl = document.getElementById("gist-image");
        if (post.img) {
            imgEl.src = post.img;
        } else {
            imgEl.parentElement.style.display = 'none';
        }

        document.getElementById("gist-desc").textContent = post.description;

        // Parse and render content
        const rawContent = post.content || "";
        const formattedContent = parseCustomText(rawContent);
        document.getElementById("gist-content").innerHTML = formattedContent;

        // Share button
        const shareBtn = document.getElementById("share-btn");
        shareBtn.onclick = () => {
            if (navigator.share) {
                navigator.share({
                    title: post.title,
                    text: post.description,
                    url: window.location.href
                }).catch(console.error);
            } else {
                navigator.clipboard.writeText(window.location.href);
                alert("Link copied to clipboard!");
            }
        };

        loader.style.display = "none";
        articleView.style.display = "block";
    }

    // --- 5. Custom Text Parser ---
    function parseCustomText(text) {
    let safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Bold, Italic, Quote
    safeText = safeText.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    safeText = safeText.replace(/#(.*?)#/g, '<em>$1</em>');
    safeText = safeText.replace(/%(.*?)%/g, '<blockquote class="custom-quote">$1</blockquote>');

    // Inline image
    safeText = safeText.replace(
        /\{img:(.*?)\}/g,
        '<div class="inline-img-wrapper"><img src="$1" class="inline-img" loading="lazy"></div>'
    );

    // YouTube (watch + short)
    safeText = safeText.replace(
        /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+))/g,
        `<div class="video-embed">
            <iframe 
                src="https://www.youtube.com/embed/$2"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                loading="lazy">
            </iframe>
        </div>`
    );

    // Vimeo
    safeText = safeText.replace(
        /(https?:\/\/(?:www\.)?vimeo\.com\/(\d+))/g,
        `<div class="video-embed">
            <iframe 
                src="https://player.vimeo.com/video/$2"
                frameborder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowfullscreen
                loading="lazy">
            </iframe>
        </div>`
    );

    // Twitter / X
    safeText = safeText.replace(
        /(https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/\d+)/g,
        `<div class="twitter-embed">
            <blockquote class="twitter-tweet">
                <a href="$1"></a>
            </blockquote>
        </div>`
    );

    // Convert newlines to <br>
    safeText = safeText.replace(/\n/g, '<br>');

    return safeText;
}

    // --- 6. Related Gist Logic (Newest → Oldest) ---
    function loadRelatedPosts(category, currentId) {
        const relatedSection = document.getElementById("related-section");
        const relatedGrid = document.getElementById("related-grid");
        const relatedCatName = document.getElementById("related-cat-name");

        if (!category) return;

        relatedCatName.textContent = category;
        relatedGrid.innerHTML = '';

        database.ref('blogPosts').once('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            const posts = Object.entries(data)
                .filter(([key, post]) =>
                    post.category === category && key !== currentId
                )
                .sort((a, b) => {
                    const timeA = parseInt(a[1].timestamp) || 0;
                    const timeB = parseInt(b[1].timestamp) || 0;
                    return timeB - timeA; // newest first
                });

            if (posts.length > 0) {
                relatedSection.style.display = "block";

                posts.slice(0, 3).forEach(([key, post]) => {
                    const card = document.createElement("div");
                    card.className = "related-card";
                    card.onclick = () =>
                        window.location.href = `fullgist.html?id=${key}`;

                    const imgUrl = post.img ||
                        'https://via.placeholder.com/300x150?text=No+Image';

                    card.innerHTML = `
                        <img src="${imgUrl}" class="related-img" alt="${post.title}">
                        <div class="related-content">
                            <h4 class="related-title">${post.title}</h4>
                            <span style="font-size:0.75rem; color:var(--primary-color)">
                                Read now &rarr;
                            </span>
                        </div>
                    `;
                    relatedGrid.appendChild(card);
                });
            } else {
                relatedSection.style.display = "none";
            }
        });
    }
});