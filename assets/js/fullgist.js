document.addEventListener("DOMContentLoaded", () => {

    /* ===============================
       1. Theme Handling
    =============================== */
    const themeToggleBtn = document.getElementById("theme-toggle");
    const themeIcon = themeToggleBtn?.querySelector("i");

    const setTheme = (theme) => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);

        if (!themeIcon) return;

        if (theme === "dark") {
            themeIcon.classList.replace("fa-moon", "fa-sun");
        } else {
            themeIcon.classList.replace("fa-sun", "fa-moon");
        }
    };

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) setTheme(savedTheme);

    themeToggleBtn?.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme");
        setTheme(current === "dark" ? "light" : "dark");
    });

    /* ===============================
       2. Get Post ID
    =============================== */
    const params = new URLSearchParams(window.location.search);
    const postId = params.get("id");

    const loader = document.getElementById("loader");
    const articleView = document.getElementById("article-view");

    if (!postId) {
        window.location.href = "index.html";
        return;
    }

    /* ===============================
       3. Fetch Post
    =============================== */
    const postRef = database.ref("blogPosts/" + postId);
    const viewCounterRef = database.ref("postViews/" + postId);

    postRef.once("value")
        .then(snapshot => {
            const post = snapshot.val();

            if (!post) {
                loader.style.display = "none";
                document.querySelector("main").innerHTML =
                    "<h2 style='text-align:center;margin-top:50px'>Gist not found</h2>";
                return;
            }

            viewCounterRef.transaction(v => (v || 0) + 1);

            renderFullPost(post);
            loadRelatedPosts(post.category, postId);
            // Initialize comment section for this post
            initComments(postId);
        })
        .catch(() => {
            loader.style.display = "none";
            document.querySelector("main").innerHTML =
                "<h2 style='text-align:center;margin-top:50px'>Error loading content</h2>";
        });

    /* ===============================
       4. Render Post (with improved share button)
    =============================== */
    function renderFullPost(post) {

        document.title = `${post.title} | GistNova`;

        const postUrl = window.location.href;
        const ogImage = post.img || "https://via.placeholder.com/1200x630?text=GistNova";

        document.getElementById("og-title").content = post.title;
        document.getElementById("og-description").content = post.description;
        document.getElementById("og-image").content = ogImage;
        document.getElementById("og-url").content = postUrl;

        document.getElementById("gist-title").textContent = post.title;
        document.getElementById("gist-category").textContent = post.category || "General";

        const dateObj = new Date(parseInt(post.timestamp) || Date.now());
        document.getElementById("gist-date").textContent =
            dateObj.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric"
            });

        const imgEl = document.getElementById("gist-image");
        if (post.img) {
            imgEl.src = post.img;
            imgEl.parentElement.style.display = "block";
        } else {
            imgEl.parentElement.style.display = "none";
        }

        document.getElementById("gist-desc").textContent = post.description;

        const formatted = parseCustomText(post.content || "");
        document.getElementById("gist-content").innerHTML = formatted;
        
        // Inject ads into content paragraphs after rendering
        injectAdsIntoContent();

        // Load Twitter widgets if they exist
        if (window.twttr && twttr.widgets) {
            setTimeout(() => {
                twttr.widgets.load(document.getElementById("gist-content"));
            }, 500);
        }

        /* ===============================
           Improved Share Button Functionality
        =============================== */
        const shareBtn = document.getElementById("share-btn");
        shareBtn.onclick = async () => {
            const shareTitle = post.title;
            const shareText = `Check out this article: ${post.title} on GistNova`;
            const shareUrl = postUrl;
            
            // Try to use the Web Share API with image if available
            if (navigator.share && navigator.canShare) {
                try {
                    // For platforms that support sharing images (like WhatsApp, Facebook)
                    if (post.img) {
                        // Fetch the image and create a File object
                        const response = await fetch(post.img);
                        const blob = await response.blob();
                        const imageFile = new File([blob], 'image.jpg', { type: blob.type });
                        
                        const shareData = {
                            title: shareTitle,
                            text: shareText,
                            url: shareUrl,
                            files: [imageFile]
                        };
                        
                        // Check if files can be shared
                        if (navigator.canShare(shareData)) {
                            await navigator.share(shareData);
                            return;
                        }
                    }
                    
                    // Fallback to basic share if image can't be shared
                    await navigator.share({
                        title: shareTitle,
                        text: shareText,
                        url: shareUrl
                    });
                } catch (error) {
                    console.log('Error sharing:', error);
                    // If sharing fails, show share options modal
                    showShareOptions(post, postUrl);
                }
            } 
            // For desktop or when Web Share API is not available
            else {
                showShareOptions(post, postUrl);
            }
        };

        loader.style.display = "none";
        articleView.style.display = "block";
    }

    /* ===============================
       5. Inject Ads into Content (Improved - Guarantees at least 2 ads)
    =============================== */
    function injectAdsIntoContent() {
        const contentDiv = document.getElementById('gist-content');
        if (!contentDiv) return;

        // Get all paragraph-like elements (exclude media wrappers)
        const paragraphs = Array.from(contentDiv.children).filter(el => {
            return el.tagName === 'P' || 
                   (el.tagName === 'DIV' && !el.classList.contains('video-embed') && 
                    !el.classList.contains('twitter-embed') && !el.classList.contains('inline-img-wrapper'));
        });

        if (paragraphs.length === 0) return;

        // --- Determine positions (indices of paragraphs after which to insert an ad) ---
        let adPositions = [];

        // Guarantee at least two ads
        if (paragraphs.length === 1) {
            // Special case: one paragraph – place one ad before it and one after it
            const topAd = createAdContainer();
            contentDiv.insertBefore(topAd, contentDiv.firstChild);
            const bottomAd = createAdContainer();
            paragraphs[0].parentNode.insertBefore(bottomAd, paragraphs[0].nextSibling);
            return; // done
        }

        // For 2+ paragraphs: always insert after first and after last
        adPositions.push(0);                           // after first paragraph
        adPositions.push(paragraphs.length - 1);       // after last paragraph

        // For longer posts, add a middle ad (if not already covered)
        if (paragraphs.length >= 6) {
            const middle = Math.floor(paragraphs.length / 2);
            if (!adPositions.includes(middle)) {
                adPositions.push(middle);
            }
        }

        // Remove duplicates and sort descending so we insert from bottom to top
        // (prevents index shifting)
        adPositions = [...new Set(adPositions)].sort((a, b) => b - a);

        // Insert ads after the chosen paragraphs
        adPositions.forEach(pos => {
            if (pos >= 0 && pos < paragraphs.length) {
                const adContainer = createAdContainer();
                paragraphs[pos].parentNode.insertBefore(adContainer, paragraphs[pos].nextSibling);
            }
        });
    }
    
    /* ===============================
       6. Create Ad Container
    =============================== */
    function createAdContainer() {
        const adDiv = document.createElement('div');
        adDiv.className = 'in-content-ad';
        
        // Using script tags for Adsterra ads
        const script1 = document.createElement('script');
        script1.type = 'text/javascript';
        script1.text = `
            atOptions = {
                'key' : 'c85c2420668093d93348395bb707269f',
                'format' : 'iframe',
                'height' : 250,
                'width' : 300,
                'params' : {}
            };
        `;
        
        const script2 = document.createElement('script');
        script2.type = 'text/javascript';
        script2.src = 'https://www.highperformanceformat.com/c85c2420668093d93348395bb707269f/invoke.js';
        script2.async = true;
        
        adDiv.appendChild(script1);
        adDiv.appendChild(script2);
        
        return adDiv;
    }
    
    /* ===============================
       7. Content Parser + Media Embed
    =============================== */
    function parseCustomText(text) {
        if (!text) return "";

        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // Bold - *text*
        html = html.replace(/\*(.*?)\*/g, "<strong>$1</strong>");

        // Italic - #text# (keep # symbols)
        html = html.replace(/#(.*?)#/g, "<em>#$1#</em>");

        // Quote - %text%
        html = html.replace(/%([\s\S]*?)%/g, function(match, p1) {
            return "<blockquote class='custom-quote'>" + p1.trim() + "</blockquote>";
        });

        // Inline Images - {img:url}
        html = html.replace(/\{img:(.*?)\}/g, function(match, url) {
            const imageUrl = url.trim();
            if (imageUrl && imageUrl.startsWith('http')) {
                return `<div class='inline-img-wrapper'><img src='${imageUrl}' class='inline-img' loading='lazy' alt='Blog image' onerror="this.onerror=null; this.src='https://via.placeholder.com/800x400?text=Image+Not+Found';"></div>`;
            }
            return '';
        });

        // YouTube
        html = html.replace(
            /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)(?:\?[\w=&-]*)?/g,
            function(match, videoId) {
                if (videoId) {
                    return `<div class="video-embed">
                        <iframe 
                            src="https://www.youtube.com/embed/${videoId}"
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen>
                        </iframe>
                    </div>`;
                }
                return match;
            }
        );

        // Vimeo
        html = html.replace(
            /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/g,
            function(match, videoId) {
                if (videoId) {
                    return `<div class="video-embed">
                        <iframe 
                            src="https://player.vimeo.com/video/${videoId}"
                            loading="lazy"
                            allowfullscreen>
                        </iframe>
                    </div>`;
                }
                return match;
            }
        );

        // Twitter / X
        html = html.replace(
            /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/g,
            function(match, statusId) {
                if (statusId) {
                    return `<div class="twitter-embed">
                        <blockquote class="twitter-tweet">
                            <a href="${match}"></a>
                        </blockquote>
                    </div>`;
                }
                return match;
            }
        );

        // Convert line breaks to <br> but not inside already formatted blocks
        let tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        function processTextNodes(node) {
            if (node.nodeType === 3) { // Text node
                if (node.textContent.includes('\n')) {
                    const lines = node.textContent.split('\n');
                    const fragment = document.createDocumentFragment();
                    for (let i = 0; i < lines.length; i++) {
                        if (i > 0) {
                            fragment.appendChild(document.createElement('br'));
                        }
                        if (lines[i]) {
                            fragment.appendChild(document.createTextNode(lines[i]));
                        }
                    }
                    node.parentNode.replaceChild(fragment, node);
                }
            } else if (node.nodeType === 1) { // Element node
                if (!['BLOCKQUOTE', 'SCRIPT', 'STYLE'].includes(node.tagName)) {
                    Array.from(node.childNodes).forEach(processTextNodes);
                }
            }
        }
        
        processTextNodes(tempDiv);
        html = tempDiv.innerHTML;
        
        return html;
    }

    /* ===============================
       8. Related Posts
    =============================== */
    function loadRelatedPosts(category, currentId) {

        if (!category) return;

        const section = document.getElementById("related-section");
        const grid = document.getElementById("related-grid");
        const label = document.getElementById("related-cat-name");

        label.textContent = category;
        grid.innerHTML = "";

        database.ref("blogPosts")
            .orderByChild("timestamp")
            .limitToLast(30)
            .once("value", snapshot => {

                const data = snapshot.val();
                if (!data) return;

                const posts = Object.entries(data)
                    .filter(([id, p]) =>
                        p && p.category === category && id !== currentId
                    )
                    .sort((a, b) => {
                        const timeA = a[1].timestamp || 0;
                        const timeB = b[1].timestamp || 0;
                        return timeB - timeA;
                    })
                    .slice(0, 4);

                if (posts.length === 0) {
                    section.style.display = "none";
                    return;
                }

                section.style.display = "block";

                posts.forEach(([id, post]) => {

                    const card = document.createElement("div");
                    card.className = "related-card";
                    card.onclick = () =>
                        window.location.href = `fullgist.html?id=${id}`;

                    const imgUrl = post.img || "https://via.placeholder.com/300x200?text=No+Image";
                    
                    card.innerHTML = `
                        <img src="${imgUrl}" alt="${post.title}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x200?text=Image+Not+Found';">
                        <div class="related-content">
                            <h4>${post.title}</h4>
                            <span class="read-link">Read now →</span>
                        </div>
                    `;

                    grid.appendChild(card);
                });
                
                // Add banner ad after related posts
                addAdAfterRelatedPosts();

            });
    }
    
    /* ===============================
       9. Add Ad After Related Posts
    =============================== */
    function addAdAfterRelatedPosts() {
        const relatedSection = document.getElementById("related-section");
        if (!relatedSection) return;
        
        // Check if ad already exists
        if (relatedSection.querySelector('.related-section-ad')) return;
        
        const adContainer = createAdContainer();
        adContainer.classList.add('related-section-ad');
        adContainer.style.marginTop = '30px';
        
        relatedSection.appendChild(adContainer);
    }

    /* ===============================
       10. Share Options Modal
    =============================== */
    function showShareOptions(post, postUrl) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('share-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'share-modal';
            modal.className = 'share-modal';
            modal.innerHTML = `
                <div class="share-modal-content">
                    <div class="share-modal-header">
                        <h3>Share this article</h3>
                        <span class="close-modal">&times;</span>
                    </div>
                    <div class="share-modal-body">
                        <div class="share-image">
                            <img src="${post.img || 'https://via.placeholder.com/300x200?text=GistNova'}" alt="${post.title}">
                        </div>
                        <div class="share-buttons-grid">
                            <button class="share-option facebook" data-url="https://www.facebook.com/sharer/sharer.php?u=">
                                <i class="fab fa-facebook-f"></i> Facebook
                            </button>
                            <button class="share-option twitter" data-url="https://twitter.com/intent/tweet?text=">
                                <i class="fab fa-twitter"></i> Twitter
                            </button>
                            <button class="share-option whatsapp" data-url="https://wa.me/?text=">
                                <i class="fab fa-whatsapp"></i> WhatsApp
                            </button>
                            <button class="share-option linkedin" data-url="https://www.linkedin.com/sharing/share-offsite/?url=">
                                <i class="fab fa-linkedin-in"></i> LinkedIn
                            </button>
                            <button class="share-option telegram" data-url="https://t.me/share/url?url=">
                                <i class="fab fa-telegram-plane"></i> Telegram
                            </button>
                            <button class="share-option copy">
                                <i class="fas fa-link"></i> Copy Link
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Add modal styles
            const style = document.createElement('style');
            style.textContent = `
                .share-modal {
                    display: none;
                    position: fixed;
                    z-index: 1000;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0,0,0,0.5);
                    animation: fadeIn 0.3s;
                }
                
                .share-modal-content {
                    background-color: var(--bg-color);
                    margin: 15% auto;
                    padding: 20px;
                    border-radius: 10px;
                    width: 90%;
                    max-width: 500px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s;
                }
                
                .share-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid var(--border-color);
                }
                
                .share-modal-header h3 {
                    margin: 0;
                    color: var(--text-color);
                }
                
                .close-modal {
                    color: var(--text-color);
                    font-size: 28px;
                    font-weight: bold;
                    cursor: pointer;
                }
                
                .close-modal:hover {
                    color: var(--primary-color);
                }
                
                .share-image {
                    margin-bottom: 20px;
                    text-align: center;
                }
                
                .share-image img {
                    max-width: 100%;
                    max-height: 200px;
                    border-radius: 5px;
                    object-fit: cover;
                }
                
                .share-buttons-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 10px;
                }
                
                .share-option {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: transform 0.2s, opacity 0.2s;
                    color: white;
                }
                
                .share-option:hover {
                    transform: translateY(-2px);
                    opacity: 0.9;
                }
                
                .share-option.facebook { background-color: #1877f2; }
                .share-option.twitter { background-color: #1da1f2; }
                .share-option.whatsapp { background-color: #25d366; }
                .share-option.linkedin { background-color: #0077b5; }
                .share-option.telegram { background-color: #0088cc; }
                .share-option.copy { background-color: #6c757d; }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideIn {
                    from { transform: translateY(-50px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                /* Dark mode support */
                [data-theme="dark"] .share-modal-content {
                    background-color: #2d2d2d;
                    color: #fff;
                }
                
                [data-theme="dark"] .share-modal-header {
                    border-bottom-color: #444;
                }
                
                @media (max-width: 480px) {
                    .share-buttons-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .share-modal-content {
                        margin: 10% auto;
                        width: 95%;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Update modal content
        const modalContent = modal.querySelector('.share-modal-content');
        modalContent.querySelector('.share-image img').src = post.img || 'https://via.placeholder.com/300x200?text=GistNova';
        modalContent.querySelector('.share-image img').alt = post.title;
        
        // Set up share buttons
        const shareText = encodeURIComponent(`Check out this article: ${post.title} on GistNova`);
        const shareUrl = encodeURIComponent(postUrl);
        
        modalContent.querySelectorAll('.share-option').forEach(btn => {
            btn.onclick = () => {
                if (btn.classList.contains('copy')) {
                    // Copy link
                    navigator.clipboard.writeText(postUrl).then(() => {
                        showToast('Link copied to clipboard!');
                    }).catch(() => {
                        alert('Failed to copy link');
                    });
                } else {
                    // Social media share
                    const baseUrl = btn.dataset.url;
                    let fullUrl;
                    
                    if (btn.classList.contains('twitter')) {
                        fullUrl = `${baseUrl}${shareText}&url=${shareUrl}`;
                    } else if (btn.classList.contains('whatsapp')) {
                        fullUrl = `${baseUrl}${shareText}%20${shareUrl}`;
                    } else {
                        fullUrl = `${baseUrl}${shareUrl}`;
                    }
                    
                    window.open(fullUrl, '_blank', 'width=600,height=400');
                }
                
                // Close modal after sharing
                modal.style.display = 'none';
            };
        });
        
        // Close modal functionality
        const closeBtn = modal.querySelector('.close-modal');
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
        
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
        
        // Show modal
        modal.style.display = 'block';
    }

    /* ===============================
       11. Toast Notification Helper
    =============================== */
    function showToast(message, duration = 3000) {
        // Remove existing toast
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create toast
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        
        // Add toast styles if not already present
        if (!document.querySelector('#toast-styles')) {
            const toastStyle = document.createElement('style');
            toastStyle.id = 'toast-styles';
            toastStyle.textContent = `
                .toast-notification {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: var(--primary-color, #007bff);
                    color: white;
                    padding: 12px 24px;
                    border-radius: 5px;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                    z-index: 2000;
                    animation: slideUp 0.3s ease;
                    font-size: 14px;
                    font-weight: 500;
                }
                
                @keyframes slideUp {
                    from { transform: translate(-50%, 100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
                
                [data-theme="dark"] .toast-notification {
                    background-color: var(--primary-color-dark, #0056b3);
                }
            `;
            document.head.appendChild(toastStyle);
        }
        
        document.body.appendChild(toast);
        
        // Remove toast after duration
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s reverse';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, duration);
    }

    /* ===============================
       12. COMMENT SECTION
    =============================== */

    let currentPostId = null;

    function initComments(postId) {
        currentPostId = postId;
        loadComments(postId);
        setupCommentForm(postId);
    }

    function loadComments(postId) {
        const commentsRef = database.ref('comments/' + postId);
        commentsRef.on('value', (snapshot) => {
            const comments = snapshot.val();
            renderComments(comments);
        });
    }

    function renderComments(commentsObj) {
        const listEl = document.getElementById('comment-list');
        const noCommentsEl = document.getElementById('no-comments');
        listEl.innerHTML = '';

        if (!commentsObj) {
            noCommentsEl.style.display = 'block';
            return;
        }

        // Convert to array and sort by timestamp descending (newest first)
        const commentsArray = Object.entries(commentsObj).map(([id, data]) => ({
            id,
            ...data
        })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (commentsArray.length === 0) {
            noCommentsEl.style.display = 'block';
            return;
        }

        noCommentsEl.style.display = 'none';

        commentsArray.forEach(comment => {
            const commentItem = document.createElement('div');
            commentItem.className = 'comment-item';

            // Format date
            const date = comment.timestamp ? new Date(comment.timestamp) : new Date();
            const dateStr = date.toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // Escape user input to prevent XSS
            const author = escapeHtml(comment.name || 'Anonymous');
            const content = escapeHtml(comment.comment || '').replace(/\n/g, '<br>');

            commentItem.innerHTML = `
                <div class="comment-header">
                    <div class="comment-author">
                        <i class="fas fa-user-circle"></i>
                        <span class="author-name" title="${author}">${author}</span>
                    </div>
                    <span class="comment-date">${dateStr}</span>
                </div>
                <div class="comment-content">${content}</div>
            `;
            listEl.appendChild(commentItem);
        });
    }

    function setupCommentForm(postId) {
        const form = document.getElementById('comment-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const nameInput = document.getElementById('comment-name');
            const emailInput = document.getElementById('comment-email');
            const commentInput = document.getElementById('comment-text');

            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const comment = commentInput.value.trim();

            if (!name || !comment) {
                alert('Please enter your name and comment.');
                return;
            }

            // Basic email validation if provided
            if (email && !/^\S+@\S+\.\S+$/.test(email)) {
                alert('Please enter a valid email address or leave it empty.');
                return;
            }

            const newComment = {
                name: name,
                email: email || null,
                comment: comment,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            const commentsRef = database.ref('comments/' + postId);
            commentsRef.push(newComment)
                .then(() => {
                    // Clear form
                    nameInput.value = '';
                    emailInput.value = '';
                    commentInput.value = '';
                })
                .catch((error) => {
                    console.error('Error posting comment:', error);
                    alert('Failed to post comment. Please try again.');
                });
        });
    }

    // Helper: escape HTML special characters
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});