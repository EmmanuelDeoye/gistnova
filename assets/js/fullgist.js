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
        // No ID provided? Redirect home.
        window.location.href = "index.html";
    }

    // ----------------------------------------------------------------------
    // --- 3. Fetch Specific Post and Increment View Count (UPDATED BLOCK) ---
    // ----------------------------------------------------------------------
    
    const postRef = database.ref('blogPosts/' + postId);
    
    // NEW: Reference to the views counter for this specific post
    const viewCounterRef = database.ref('postViews/' + postId);

    postRef.once('value').then((snapshot) => {
        const post = snapshot.val();

        if (post) {
            // NEW: Increment the view count by 1 (using transaction for safety)
            // A transaction prevents race conditions if multiple users load the page simultaneously.
            viewCounterRef.transaction((currentViews) => {
                // If the views are null (first view), set to 1. Otherwise, increment.
                return (currentViews || 0) + 1;
            });
            
            renderFullPost(post);
            loadRelatedPosts(post.category, postId);
        } else {
            // ID exists in URL but not in DB
            loader.style.display = "none";
            document.querySelector('main').innerHTML = "<h2 style='text-align:center; margin-top:50px'>Gist not found!</h2>";
        }
    }).catch((error) => {
        console.error("Error fetching gist:", error);
        loader.style.display = "none";
        document.querySelector('main').innerHTML = "<h2 style='text-align:center; margin-top:50px'>Error loading content.</h2>";
    });

    // --- 4. Render Function with Rich Text Parser ---
    function renderFullPost(post) {
        document.title = `${post.title} | GistHub`;
        
        document.getElementById("gist-title").textContent = post.title;
        document.getElementById("gist-category").textContent = post.category || "General";
        
        const dateObj = new Date(parseInt(post.timestamp) || Date.now());
        document.getElementById("gist-date").textContent = dateObj.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        // Image Handling
        const imgEl = document.getElementById("gist-image");
        if (post.img) {
            imgEl.src = post.img;
        } else {
            imgEl.parentElement.style.display = 'none';
        }

        document.getElementById("gist-desc").textContent = post.description;

        // --- THE PARSER (Handles bold, italic, quotes, and inline images) ---
        const rawContent = post.content || "";
        const formattedContent = parseCustomText(rawContent);
        
        document.getElementById("gist-content").innerHTML = formattedContent;

        // Share Button Logic
        const shareBtn = document.getElementById("share-btn");
        shareBtn.onclick = () => {
            if (navigator.share) {
                navigator.share({
                    title: post.title,
                    text: post.description,
                    url: window.location.href
                }).catch(console.error);
            } else {
                // Fallback for desktop/unsupported
                navigator.clipboard.writeText(window.location.href);
                alert("Link copied to clipboard!");
            }
        };

        loader.style.display = "none";
        articleView.style.display = "block";
    }

    // --- 5. Custom Text Parser Helper ---
    function parseCustomText(text) {
        let safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Bold: *content* -> <strong>content</strong>
        safeText = safeText.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
        
        // Italics: #content# -> <em>content</em>
        safeText = safeText.replace(/#(.*?)#/g, '<em>$1</em>');
        
        // Quotes: %content% -> <blockquote class="custom-quote">content</blockquote>
        safeText = safeText.replace(/%(.*?)%/g, '<blockquote class="custom-quote">$1</blockquote>');

        // Inline Images: {img:URL} -> <div...><img...></div>
        safeText = safeText.replace(/\{img:(.*?)\}/g, '<div class="inline-img-wrapper"><img src="$1" class="inline-img" loading="lazy" /></div>');

        // Preserve Line Breaks (convert newlines to <br>)
        safeText = safeText.replace(/\n/g, '<br>');

        return safeText;
    }

    // --- 6. Related Gist Logic ---
    function loadRelatedPosts(category, currentId) {
        const relatedSection = document.getElementById("related-section");
        const relatedGrid = document.getElementById("related-grid");
        const relatedCatName = document.getElementById("related-cat-name");

        if(!category) return;

        relatedCatName.textContent = category;
        relatedGrid.innerHTML = ''; // Clear previous content

        // Fetch all posts (or a limited number)
        database.ref('blogPosts').limitToLast(20).once('value', (snapshot) => {
            const data = snapshot.val();
            if(!data) return;

            const posts = Object.entries(data);
            
            // Filter: Same Category AND Not Current Post
            const related = posts.filter(([key, post]) => {
                return post.category === category && key !== currentId;
            });

            if (related.length > 0) {
                relatedSection.style.display = "block";
                
                // Show max 3 posts
                related.slice(0, 3).forEach(([key, post]) => {
                    const card = document.createElement("div");
                    card.className = "related-card";
                    card.onclick = () => window.location.href = `fullgist.html?id=${key}`;
                    
                    const imgUrl = post.img || 'https://via.placeholder.com/300x150?text=No+Image';

                    card.innerHTML = `
                        <img src="${imgUrl}" class="related-img" alt="${post.title}">
                        <div class="related-content">
                            <h4 class="related-title">${post.title}</h4>
                            <span style="font-size:0.75rem; color:var(--primary-color)">Read now &rarr;</span>
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
