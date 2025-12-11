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
            document.querySelector('main').innerHTML = "<h2 style='text-align:center; margin-top:50px'>Gist not found!</h2>";
        }
    }).catch((error) => {
        console.error("Error fetching gist:", error);
        loader.style.display = "none";
        document.querySelector('main').innerHTML = "<h2 style='text-align:center; margin-top:50px'>Error loading content.</h2>";
    });

    // --- 4. Render Function with Ad Injection ---
    function renderFullPost(post) {
        document.title = `${post.title} | GistNova`;
        
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

        // 1. Parse formatting (*bold*, etc.)
        const rawContent = post.content || "";
        const formattedContent = parseCustomText(rawContent);
        
        // 2. Inject Ad Placeholders into the text
        const contentWithAds = injectAdPlaceholders(formattedContent);
        
        // 3. Render to DOM
        document.getElementById("gist-content").innerHTML = contentWithAds;

        // 4. Activate Ads (Fill the placeholders)
        renderAdsInPlaceholders();

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
        safeText = safeText.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
        safeText = safeText.replace(/#(.*?)#/g, '<em>$1</em>');
        safeText = safeText.replace(/%(.*?)%/g, '<blockquote class="custom-quote">$1</blockquote>');
        safeText = safeText.replace(/\{img:(.*?)\}/g, '<div class="inline-img-wrapper"><img src="$1" class="inline-img" loading="lazy" /></div>');
        
        // Convert newlines to <br> for HTML rendering
        safeText = safeText.replace(/\n/g, '<br>');

        return safeText;
    }

    // --- NEW: Inject Ad Placeholders Logic ---
    function injectAdPlaceholders(htmlContent) {
        // Split content by <br> tags to count "paragraphs"
        const paragraphs = htmlContent.split('<br>');
        
        // Don't show ads if content is too short (less than 6 lines)
        if (paragraphs.length < 6) return htmlContent;

        // Logic: How many ads?
        // 6-15 lines = 2 ads
        // 16-30 lines = 3 ads
        // 30+ lines = 4 ads
        let numAds = 2;
        if (paragraphs.length > 15) numAds = 3;
        if (paragraphs.length > 30) numAds = 4;

        // Calculate spacing
        const interval = Math.floor(paragraphs.length / (numAds + 1));

        let newHtml = "";
        let adsInserted = 0;

        paragraphs.forEach((para, index) => {
            newHtml += para + "<br>";

            // Check if we should insert an ad placeholder here
            // Ensure we don't insert immediately at the start (index > 2)
            if (index > 2 && adsInserted < numAds) {
                // If current index is a multiple of the interval
                if ((index % interval === 0)) {
                    newHtml += `<div class="in-content-ad" id="ad-spot-${adsInserted}"></div>`;
                    adsInserted++;
                }
            }
        });

        return newHtml;
    }

    // --- NEW: Render Ads into Placeholders Safely ---
    function renderAdsInPlaceholders() {
        const adPlaceholders = document.querySelectorAll('.in-content-ad');
        
        adPlaceholders.forEach(placeholder => {
            const iframe = document.createElement("iframe");
            iframe.width = "300";
            iframe.height = "250";
            iframe.scrolling = "no";
            
            // Adsterra Script
            const adScript = `
                <body style="margin:0; padding:0; display:flex; justify-content:center; align-items:center;">
                    <script type="text/javascript">
                        atOptions = { 
                            'key' : '3b97e073d0dae7b3c52e27150c01a30a', 
                            'format' : 'iframe', 
                            'height' : 250, 
                            'width' : 300, 
                            'params' : {} 
                        };
                    </script>
                    <script type="text/javascript" src="//www.highperformanceformat.com/3b97e073d0dae7b3c52e27150c01a30a/invoke.js"></script>
                </body>
            `;

            placeholder.appendChild(iframe);

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(adScript);
            doc.close();
        });
    }

    // --- 6. Related Gist Logic ---
    function loadRelatedPosts(category, currentId) {
        const relatedSection = document.getElementById("related-section");
        const relatedGrid = document.getElementById("related-grid");
        const relatedCatName = document.getElementById("related-cat-name");

        if(!category) return;

        relatedCatName.textContent = category;
        relatedGrid.innerHTML = ''; 

        database.ref('blogPosts').limitToLast(20).once('value', (snapshot) => {
            const data = snapshot.val();
            if(!data) return;

            const posts = Object.entries(data);
            
            const related = posts.filter(([key, post]) => {
                return post.category === category && key !== currentId;
            });

            if (related.length > 0) {
                relatedSection.style.display = "block";
                
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
