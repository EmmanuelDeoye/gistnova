// assets/js/home.js

document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. Theme Handling
    // ==========================================
    const themeToggleBtn = document.getElementById("theme-toggle");
    const themeIcon = themeToggleBtn.querySelector("i");
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

    const setTheme = (theme) => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
        themeIcon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
    };

    const currentTheme = localStorage.getItem("theme");
    if (currentTheme) {
        setTheme(currentTheme);
    } else if (prefersDarkScheme.matches) {
        setTheme("dark");
    }

    themeToggleBtn.addEventListener("click", () => {
        const theme = document.documentElement.getAttribute("data-theme");
        setTheme(theme === "dark" ? "light" : "dark");
    });

    // ==========================================
    // 2. Caching Keys
    // ==========================================
    const STORAGE_POSTS_KEY = 'gistnova_home_posts';
    const STORAGE_FILTERS_KEY = 'gistnova_home_filters';

    // ==========================================
    // 3. DOM Elements
    // ==========================================
    const blogGrid = document.getElementById("blog-grid");
    const loader = document.getElementById("loader");
    const searchInput = document.getElementById("search-input");
    const categorySelect = document.getElementById("category-filter");
    const sortSelect = document.getElementById("sort-filter");

    let allPosts = [];

    // ==========================================
    // 4. Load Cached Data (if any)
    // ==========================================
    let cachedPosts = null;
    try {
        const cached = sessionStorage.getItem(STORAGE_POSTS_KEY);
        if (cached) {
            cachedPosts = JSON.parse(cached);
        }
    } catch (e) {
        console.warn("Failed to parse cached posts", e);
    }

    // Load cached filters and apply to inputs
    try {
        const filters = sessionStorage.getItem(STORAGE_FILTERS_KEY);
        if (filters) {
            const parsed = JSON.parse(filters);
            if (parsed.search) searchInput.value = parsed.search;
            if (parsed.category) categorySelect.value = parsed.category;
            if (parsed.sort) sortSelect.value = parsed.sort;
        }
    } catch (e) {
        console.warn("Failed to parse cached filters", e);
    }

    // If we have cached posts, render immediately and hide loader
    if (cachedPosts && cachedPosts.length) {
        loader.style.display = "none";
        allPosts = cachedPosts;
        populateCategories(allPosts);          // fill category dropdown from cache
        filterAndRender();                      // render grid with current filters
    }

    // ==========================================
    // 5. Firebase Listener (always runs, updates cache)
    // ==========================================
    const postsRef = database.ref("blogPosts");
    postsRef.on("value", (snapshot) => {
        const data = snapshot.val();
        loader.style.display = "none";

        if (data) {
            const newPosts = Object.entries(data).map(([key, value]) => ({
                id: key,
                ...value
            }));

            // Save to sessionStorage for next visit
            sessionStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(newPosts));

            // Update global variable and re-render
            allPosts = newPosts;
            populateCategories(allPosts);
            filterAndRender();
        } else {
            blogGrid.innerHTML = `
                <p style="text-align:center; width:100%;">
                    No gist available yet!
                </p>
            `;
        }
    }, (error) => {
        console.error("Error fetching data:", error);
        loader.style.display = "none";
        blogGrid.innerHTML = "<p>Error loading content.</p>";
    });

    // ==========================================
    // 6. Filter, Sort & Render
    // ==========================================
    function populateCategories(posts) {
        const categories = new Set();
        posts.forEach(post => {
            if (post.category) categories.add(post.category);
        });

        // Preserve current selection if possible
        const currentCategory = categorySelect.value;
        categorySelect.innerHTML = `<option value="all">All Categories</option>`;

        categories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);
        });

        // Restore selected category (if it still exists)
        if (currentCategory && categories.has(currentCategory)) {
            categorySelect.value = currentCategory;
        }
    }

    function filterAndRender() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const categoryValue = categorySelect.value;
        const sortValue = sortSelect.value;

        let filtered = allPosts.filter(post => {
            const titleMatch = (post.title || "").toLowerCase().includes(searchTerm);
            const descMatch = (post.description || "").toLowerCase().includes(searchTerm);
            const categoryMatch = categoryValue === "all" || post.category === categoryValue;
            return (titleMatch || descMatch) && categoryMatch;
        });

        filtered.sort((a, b) => {
            const timeA = parseInt(a.timestamp) || 0;
            const timeB = parseInt(b.timestamp) || 0;
            return sortValue === "newest" ? timeB - timeA : timeA - timeB;
        });

        renderPosts(filtered);
        saveFilters(); // save current filter state to sessionStorage
    }

    function renderPosts(posts) {
        blogGrid.innerHTML = "";

        if (posts.length === 0) {
            blogGrid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted);">
                    <i class="fas fa-search" style="font-size:2rem; margin-bottom:10px; opacity:0.5;"></i>
                    <p>No gist found matching your criteria.</p>
                </div>
            `;
            return;
        }

        posts.forEach(post => createPostCard(post));
    }

    function createPostCard(post) {
        const imageUrl = post.img || "https://via.placeholder.com/400x250?text=No+Image";
        const dateObj = new Date(parseInt(post.timestamp) || Date.now());
        const dateString = dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });

        const card = document.createElement("article");
        card.className = "blog-card";
        card.onclick = () => window.location.href = `fullgist.html?id=${post.id}`;

        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${imageUrl}" alt="${post.title}" loading="lazy">
            </div>
            <div class="card-content">
                <span class="card-category">${post.category || "Gist"}</span>
                <h3 class="card-title">${post.title}</h3>
                <p class="card-desc">${post.description}</p>
                <div class="card-footer">
                    <span><i class="far fa-clock"></i> ${dateString}</span>
                    <span style="color:var(--primary-color)">Read More →</span>
                </div>
            </div>
        `;

        blogGrid.appendChild(card);
    }

    // ==========================================
    // 7. Save filter state to sessionStorage
    // ==========================================
    function saveFilters() {
        const filters = {
            search: searchInput.value,
            category: categorySelect.value,
            sort: sortSelect.value
        };
        sessionStorage.setItem(STORAGE_FILTERS_KEY, JSON.stringify(filters));
    }

    // ==========================================
    // 8. Event Listeners for filters
    // ==========================================
    searchInput.addEventListener("input", filterAndRender);
    categorySelect.addEventListener("change", filterAndRender);
    sortSelect.addEventListener("change", filterAndRender);

    // ==========================================
    // 9. Footer & Modals (unchanged)
    // ==========================================
    const aboutLink = document.getElementById("open-about");
    const termsLink = document.getElementById("open-terms");
    const aboutModal = document.getElementById("modal-about");
    const termsModal = document.getElementById("modal-terms");
    const closeButtons = document.querySelectorAll(".close-modal");

    if (aboutLink) {
        aboutLink.addEventListener("click", e => {
            e.preventDefault();
            aboutModal.style.display = "block";
        });
    }
    if (termsLink) {
        termsLink.addEventListener("click", e => {
            e.preventDefault();
            termsModal.style.display = "block";
        });
    }
    closeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            aboutModal.style.display = "none";
            termsModal.style.display = "none";
        });
    });
    window.addEventListener("click", e => {
        if (e.target === aboutModal) aboutModal.style.display = "none";
        if (e.target === termsModal) termsModal.style.display = "none";
    });

    // ==========================================
    // 10. Newsletter (UI only)
    // ==========================================
    const newsletterForm = document.getElementById("newsletter-form");
    if (newsletterForm) {
        newsletterForm.addEventListener("submit", e => {
            e.preventDefault();
            const input = newsletterForm.querySelector("input");
            if (input.value) {
                alert(`Thanks for subscribing! We've sent a confirmation to ${input.value}`);
                input.value = "";
            }
        });
    }
});