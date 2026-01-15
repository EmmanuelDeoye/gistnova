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

        if (theme === "dark") {
            themeIcon.classList.remove("fa-moon");
            themeIcon.classList.add("fa-sun");
        } else {
            themeIcon.classList.remove("fa-sun");
            themeIcon.classList.add("fa-moon");
        }
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
    // 2. Data Fetching & State Management
    // ==========================================
    const blogGrid = document.getElementById("blog-grid");
    const loader = document.getElementById("loader");

    const searchInput = document.getElementById("search-input");
    const categorySelect = document.getElementById("category-filter");
    const sortSelect = document.getElementById("sort-filter");

    let allPosts = [];

    const postsRef = database.ref("blogPosts");

    postsRef.on("value", (snapshot) => {
        const data = snapshot.val();
        loader.style.display = "none";

        if (data) {
            allPosts = Object.entries(data).map(([key, value]) => ({
                id: key,
                ...value
            }));

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
    // 3. Filter, Sort & Render Logic
    // ==========================================
    function populateCategories(posts) {
        const categories = new Set();

        posts.forEach(post => {
            if (post.category) categories.add(post.category);
        });

        categorySelect.innerHTML = `<option value="all">All Categories</option>`;

        categories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);
        });
    }

    function filterAndRender() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const categoryValue = categorySelect.value;
        const sortValue = sortSelect.value;

        let filtered = allPosts.filter(post => {
            const titleMatch = (post.title || "").toLowerCase().includes(searchTerm);
            const descMatch = (post.description || "").toLowerCase().includes(searchTerm);
            const textMatch = titleMatch || descMatch;

            const categoryMatch = categoryValue === "all" || post.category === categoryValue;

            return textMatch && categoryMatch;
        });

        filtered.sort((a, b) => {
            const timeA = parseInt(a.timestamp) || 0;
            const timeB = parseInt(b.timestamp) || 0;
            return sortValue === "newest" ? timeB - timeA : timeA - timeB;
        });

        renderPosts(filtered);
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

        posts.forEach(post => {
            createPostCard(post);
        });
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

        card.onclick = () => {
            window.location.href = `fullgist.html?id=${post.id}`;
        };

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
    // 4. Event Listeners
    // ==========================================
    searchInput.addEventListener("input", filterAndRender);
    categorySelect.addEventListener("change", filterAndRender);
    sortSelect.addEventListener("change", filterAndRender);

    // ==========================================
    // 5. Footer & Modals
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
    // 6. Newsletter (UI only)
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