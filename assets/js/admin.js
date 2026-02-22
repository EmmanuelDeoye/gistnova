// assets/js/admin.js

document.addEventListener("DOMContentLoaded", () => {
    
    // --- FIREBASE REFERENCES ---
    const viewsRef = firebase.database().ref('postViews'); 
    const postsRef = firebase.database().ref('blogPosts'); 
    const commentsRef = firebase.database().ref('comments'); 
    
    // --- Global variables ---
    let allPosts = [];
    let allViewCounts = {};
    let allCommentCounts = {}; // Store comment counts per post
    let currentFilterCategory = 'all';
    let currentSearchTerm = '';
    let currentSortOption = 'newest';
    let currentPostIdForModal = null; // For comment modal
    
    // --- DOM Elements (declare all at the top) ---
    const loginOverlay = document.getElementById("login-overlay");
    const loginBtn = document.getElementById("login-btn");
    const passInput = document.getElementById("passcode-input");
    const errorMsg = document.getElementById("error-msg");
    const adminPanel = document.getElementById("admin-panel");
    
    const themeToggle = document.getElementById('theme-toggle');
    
    const tabButtons = document.querySelectorAll(".tab-btn");
    const contentSections = document.querySelectorAll(".content-section");
    
    const fileInput = document.getElementById("image-file");
    const statusText = document.getElementById("upload-status");
    const hiddenUrlInput = document.getElementById("final-image-url");
    const progressFill = document.getElementById("progress-fill");
    
    const form = document.getElementById("blog-form");
    const submitBtn = document.getElementById("submit-btn");
    const postIdToEditInput = document.getElementById("post-id-to-edit");
    const clearDraftIcon = document.getElementById("clear-draft-icon");
    
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');
    const clearSearch = document.getElementById('clear-search');
    const resultsCount = document.getElementById('results-count');
    
    const modal = document.getElementById('comment-modal');
    const modalBody = document.getElementById('comment-modal-body');
    const closeModal = document.querySelector('.close-modal');
    
    // --- 1. SECURITY CHECK ---
    const SECRET_CODE = "4";

    loginBtn.addEventListener("click", () => {
        if (passInput.value === SECRET_CODE) {
            loginOverlay.style.opacity = "0";
            setTimeout(() => {
                loginOverlay.style.display = "none";
                adminPanel.style.display = "block";
                restoreState(); // Restore all saved state
                loadDashboardStats();
                loadPostsTable();
            }, 300);
        } else {
            errorMsg.textContent = "Incorrect passcode!";
            passInput.value = "";
            passInput.style.borderColor = "red";
            setTimeout(() => {
                passInput.style.borderColor = "";
            }, 1000);
        }
    });

    passInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") loginBtn.click();
    });

    // --- 2. THEME TOGGLE ---
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggle.style.transform = 'rotate(360deg)';
        setTimeout(() => { themeToggle.style.transform = ''; }, 300);
    });

    // --- 3. TAB NAVIGATION + STATE SAVE ---
    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            const targetId = button.getAttribute("data-target");
            tabButtons.forEach(btn => btn.classList.remove("active"));
            contentSections.forEach(sec => sec.style.display = "none");
            button.classList.add("active");
            document.getElementById(targetId).style.display = "block";
            
            // Save active tab
            localStorage.setItem('adminActiveTab', targetId);
            
            if (targetId === 'manage-posts') {
                loadPostsTable(); // Refresh table
            }
        });
    });

    // --- 4. IMAGE UPLOAD ---
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.match('image.*')) { alert('Please select an image file'); return; }
        if (file.size > 5 * 1024 * 1024) { alert('Image size should be less than 5MB'); return; }

        const fileName = Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const storageRef = firebase.storage().ref('blogImages/' + fileName);
        const uploadTask = storageRef.put(file);

        statusText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        statusText.style.color = "inherit";

        uploadTask.on('state_changed', 
            (snapshot) => { progressFill.style.width = (snapshot.bytesTransferred / snapshot.totalBytes * 100) + "%"; },
            (error) => {
                console.error("Upload failed:", error);
                statusText.innerHTML = '<i class="fas fa-exclamation-circle"></i> Upload Failed';
                statusText.style.color = "var(--danger)";
                progressFill.style.width = "0%";
            },
            () => {
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    hiddenUrlInput.value = downloadURL;
                    statusText.innerHTML = '<i class="fas fa-check-circle"></i> Upload Complete!';
                    statusText.style.color = "var(--success)";
                    progressFill.style.backgroundColor = "var(--success)";
                    saveFormDraft(); // Save draft after upload
                });
            }
        );
    });

    // --- 5. FORM SUBMISSION ---
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const postId = postIdToEditInput.value;
        const isEditing = !!postId;

        const title = document.getElementById("post-title").value;
        const category = document.getElementById("post-category").value;
        const desc = document.getElementById("post-desc").value;
        const content = document.getElementById("post-content").value;
        const imgUrl = hiddenUrlInput.value;

        if (!title || !category || !desc || !content) {
            alert('Please fill in all required fields');
            return;
        }

        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        submitBtn.disabled = true;

        let postData = {
            title, category, description: desc, content,
            img: imgUrl || null,
            lastModified: firebase.database.ServerValue.TIMESTAMP
        };

        let operationPromise;
        if (isEditing) {
            operationPromise = postsRef.child(postId).update(postData);
        } else {
            postData.timestamp = firebase.database.ServerValue.TIMESTAMP;
            operationPromise = postsRef.push(postData);
        }

        operationPromise
        .then(() => {
            alert(`✨ Gist ${isEditing ? 'Updated' : 'Published'} Successfully!`);
            resetForm();
            clearFormDraft(); // Clear saved draft
            loadDashboardStats();
            loadPostsTable();
            if (!isEditing) {
                document.querySelector('.tab-btn[data-target="manage-posts"]').click();
            }
        })
        .catch((error) => {
            alert("Error: " + error.message);
            submitBtn.innerHTML = isEditing ? '<i class="fas fa-edit"></i> Update Gist' : '<i class="fas fa-paper-plane"></i> Publish Gist';
            submitBtn.disabled = false;
        });
    });

    // Clear draft icon
    if (clearDraftIcon) {
        clearDraftIcon.addEventListener('click', () => {
            if (confirm("Clear all form data? This cannot be undone.")) {
                resetForm();
                clearFormDraft();
            }
        });
    }

    // --- 6. SEARCH AND FILTER SETUP ---
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearchTerm = searchInput.value.toLowerCase();
            clearSearch.classList.toggle('visible', currentSearchTerm.length > 0);
            filterAndDisplayPosts();
            saveManageState(); // Save filter state
        }, 300);
    });

    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        currentSearchTerm = '';
        clearSearch.classList.remove('visible');
        filterAndDisplayPosts();
        saveManageState();
    });

    categoryFilter.addEventListener('change', () => {
        currentFilterCategory = categoryFilter.value;
        filterAndDisplayPosts();
        saveManageState();
    });

    sortFilter.addEventListener('change', () => {
        currentSortOption = sortFilter.value;
        filterAndDisplayPosts();
        saveManageState();
    });

    // --- 7. DASHBOARD STATS ---
    async function loadDashboardStats() {
        try {
            const postsSnapshot = await postsRef.once('value');
            const viewsSnapshot = await viewsRef.once('value');
            
            const posts = postsSnapshot.val() || {};
            const views = viewsSnapshot.val() || {};
            
            const postsArray = Object.entries(posts);
            const totalPosts = postsArray.length;
            
            let totalViews = 0;
            Object.values(views).forEach(v => totalViews += v || 0);
            const avgViews = totalPosts > 0 ? Math.round(totalViews / totalPosts) : 0;
            
            let lastPosted = 'Never';
            if (postsArray.length > 0) {
                const sorted = postsArray.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
                const last = sorted[0][1];
                if (last.timestamp) {
                    lastPosted = new Date(last.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }
            }
            
            animateValue('total-posts', 0, totalPosts, 1000);
            animateValue('total-views', 0, totalViews, 1000);
            animateValue('avg-views', 0, avgViews, 1000);
            document.getElementById('last-posted').textContent = lastPosted;
            
        } catch (error) {
            console.error("Error loading dashboard stats:", error);
        }
    }

    function animateValue(elementId, start, end, duration) {
        const element = document.getElementById(elementId);
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        const timer = setInterval(() => {
            current += increment;
            if (current >= end) {
                element.textContent = end.toLocaleString();
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current).toLocaleString();
            }
        }, 16);
    }

    // --- 8. FETCH VIEWS AND COMMENT COUNTS ---
    async function fetchViewCounts() {
        const snapshot = await viewsRef.once('value');
        allViewCounts = snapshot.val() || {};
    }

    async function fetchCommentCounts() {
        const snapshot = await commentsRef.once('value');
        const allComments = snapshot.val() || {};
        allCommentCounts = {};
        Object.entries(allComments).forEach(([postId, comments]) => {
            allCommentCounts[postId] = Object.keys(comments).length;
        });
    }

    // --- 9. FILTER AND DISPLAY POSTS ---
    function filterAndDisplayPosts() {
        const tbody = document.getElementById("posts-tbody");
        
        if (!allPosts.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-newspaper"></i><br>No posts found</td></tr>';
            resultsCount.textContent = 'No posts found';
            return;
        }

        let filtered = allPosts;
        if (currentFilterCategory !== 'all') {
            filtered = filtered.filter(([_, p]) => p.category === currentFilterCategory);
        }
        if (currentSearchTerm) {
            filtered = filtered.filter(([_, p]) => 
                (p.title && p.title.toLowerCase().includes(currentSearchTerm)) ||
                (p.description && p.description.toLowerCase().includes(currentSearchTerm))
            );
        }

        filtered.sort((a, b) => {
            const [keyA, postA] = a; const [keyB, postB] = b;
            const viewsA = allViewCounts[keyA] || 0;
            const viewsB = allViewCounts[keyB] || 0;
            switch(currentSortOption) {
                case 'newest': return (postB.timestamp || 0) - (postA.timestamp || 0);
                case 'oldest': return (postA.timestamp || 0) - (postB.timestamp || 0);
                case 'most-viewed': return viewsB - viewsA;
                case 'least-viewed': return viewsA - viewsB;
                case 'a-z': return (postA.title || '').localeCompare(postB.title || '');
                case 'z-a': return (postB.title || '').localeCompare(postA.title || '');
                default: return 0;
            }
        });

        resultsCount.textContent = `Showing ${filtered.length} of ${allPosts.length} posts`;
        renderPostsTable(filtered);
    }

    // --- 10. RENDER POSTS TABLE (with comment counts) ---
    function renderPostsTable(postsArray) {
        const tbody = document.getElementById("posts-tbody");
        const tableEl = document.getElementById("posts-table");
        const loadingEl = document.getElementById("loading-posts");
        
        tbody.innerHTML = '';
        loadingEl.style.display = 'none';
        tableEl.style.display = 'table';

        if (postsArray.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-search"></i><br>No posts match</td></tr>`;
            return;
        }

        postsArray.forEach(([key, post]) => {
            if (!post) return;
            
            const views = allViewCounts[key] || 0;
            const commentCount = allCommentCounts[key] || 0;
            const date = post.timestamp ? new Date(post.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'No date';
            const imgUrl = post.img || 'https://via.placeholder.com/80x60?text=No+Image';
            
            const row = tbody.insertRow();
            
            row.innerHTML = `
                <td data-label="Image"><img src="${imgUrl}" class="post-image" alt="Cover" loading="lazy" onerror="this.src='https://via.placeholder.com/80x60?text=Error';"></td>
                <td data-label="Title"><strong>${post.title || 'Untitled'}</strong></td>
                <td data-label="Category"><span style="background:var(--primary-soft); color:var(--primary-color); padding:4px 12px; border-radius:20px; font-size:0.85rem;">${post.category || 'General'}</span></td>
                <td data-label="Date">${date}</td>
                <td data-label="Views"><i class="far fa-eye"></i> ${views.toLocaleString()}</td>
                <td data-label="Comments">
                    <span class="comment-count-badge" onclick="openCommentModal('${key}')">
                        <i class="fas fa-comment"></i> ${commentCount}
                    </span>
                </td>
                <td data-label="Actions">
                    <button class="action-btn" onclick="editPost('${key}')" title="Edit Post"><i class="fas fa-pencil-alt"></i> Edit</button>
                    <button class="action-btn delete-btn" onclick="deletePost('${key}')" title="Delete Post"><i class="fas fa-trash-alt"></i> Delete</button>
                    <a href="fullgist.html?id=${key}" target="_blank" class="action-btn" title="View Live Post"><i class="fas fa-eye"></i> View</a>
                </td>
            `;
        });
    }

    // --- 11. LOAD POSTS TABLE ---
    function loadPostsTable() {
        const loadingEl = document.getElementById("loading-posts");
        const tableEl = document.getElementById("posts-table");
        
        loadingEl.style.display = 'block';
        tableEl.style.display = 'none';

        Promise.all([fetchViewCounts(), fetchCommentCounts()]).then(() => {
            postsRef.orderByChild('timestamp').once('value', (snapshot) => {
                const data = snapshot.val();
                allPosts = data ? Object.entries(data) : [];
                filterAndDisplayPosts();
                loadDashboardStats();
            });
        });
    }

    // --- 12. EDIT FUNCTION (with state persistence) ---
    window.editPost = function(postId) {
        document.querySelector('.tab-btn[data-target="create-post"]').click();
        
        const sectionTitle = document.querySelector("#create-post .section-title");
        sectionTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Article';
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Gist';
        submitBtn.classList.add("edit-mode");
        form.classList.add("edit-mode");

        postsRef.child(postId).once('value', (snapshot) => {
            const post = snapshot.val();
            if (post) {
                postIdToEditInput.value = postId;
                
                document.getElementById("post-title").value = post.title || '';
                document.getElementById("post-category").value = post.category || 'Entertainment';
                document.getElementById("post-desc").value = post.description || '';
                document.getElementById("post-content").value = post.content || '';
                
                if (post.img) {
                    hiddenUrlInput.value = post.img;
                    statusText.innerHTML = '<i class="fas fa-check-circle"></i> Image Loaded';
                    statusText.style.color = "var(--primary-color)";
                    progressFill.style.width = "100%";
                    progressFill.style.backgroundColor = "var(--primary-color)";
                } else {
                    statusText.textContent = 'No Image';
                }
                
                // Save edit state to localStorage
                saveFormDraft();
            }
        });
    }

    // --- 13. DELETE POST ---
    window.deletePost = function(postId) {
        if (confirm("🗑️ Are you sure you want to delete this post? This cannot be undone.")) {
            const deleteBtn = event.target.closest('.delete-btn');
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            deleteBtn.disabled = true;

            postsRef.child(postId).remove()
            .then(() => {
                viewsRef.child(postId).remove();
                commentsRef.child(postId).remove(); // Also delete all comments
                alert("✅ Post successfully deleted!");
                loadDashboardStats();
                loadPostsTable();
            })
            .catch((error) => {
                alert("Error deleting post: " + error.message);
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
                deleteBtn.disabled = false;
            });
        }
    }

    // --- 14. COMMENT MODAL ---
    window.openCommentModal = function(postId) {
        currentPostIdForModal = postId;
        modal.style.display = 'block';
        modalBody.innerHTML = '<div class="loading-comments">Loading comments...</div>';
        loadCommentsForPost(postId);
    };

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            modal.style.display = 'none';
            currentPostIdForModal = null;
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            currentPostIdForModal = null;
        }
    });

    function loadCommentsForPost(postId) {
        commentsRef.child(postId).once('value', (snapshot) => {
            const comments = snapshot.val();
            if (!comments) {
                modalBody.innerHTML = '<div class="no-comments"><i class="fas fa-comment-slash"></i><br>No comments yet.</div>';
                return;
            }

            const commentsArray = Object.entries(comments).map(([id, data]) => ({ id, ...data }))
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            let html = '';
            commentsArray.forEach(comment => {
                const date = comment.timestamp ? new Date(comment.timestamp).toLocaleString() : 'Unknown date';
                const isOfficial = comment.name === 'GISTNOVA OFFICIAL';
                const officialBadge = isOfficial ? '<span class="official-badge">Official</span>' : '';
                html += `
                    <div class="comment-item" data-comment-id="${comment.id}">
                        <div class="comment-header">
                            <div class="comment-author">
                                <i class="fas fa-user-circle"></i>
                                <span class="author-name">${escapeHtml(comment.name || 'Anonymous')}</span>
                                ${officialBadge}
                            </div>
                            <span class="comment-date">${date}</span>
                        </div>
                        <div class="comment-content">${escapeHtml(comment.comment || '').replace(/\n/g, '<br>')}</div>
                        <div class="comment-actions">
                            <button class="comment-reply-btn" onclick="showReplyForm('${comment.id}')"><i class="fas fa-reply"></i> Reply</button>
                            <button class="comment-delete-btn" onclick="deleteComment('${postId}', '${comment.id}')"><i class="fas fa-trash-alt"></i> Delete</button>
                        </div>
                        <div id="reply-form-${comment.id}" class="reply-form" style="display:none;">
                            <textarea placeholder="Type your official reply..." rows="2"></textarea>
                            <div class="reply-form-actions">
                                <button class="reply-submit" onclick="submitReply('${postId}', '${comment.id}')">Submit Reply</button>
                                <button class="reply-cancel" onclick="hideReplyForm('${comment.id}')">Cancel</button>
                            </div>
                        </div>
                    </div>
                `;
            });
            modalBody.innerHTML = html;
        });
    }

    // Show reply form
    window.showReplyForm = function(commentId) {
        document.getElementById(`reply-form-${commentId}`).style.display = 'block';
    };

    window.hideReplyForm = function(commentId) {
        document.getElementById(`reply-form-${commentId}`).style.display = 'none';
    };

    // Submit reply (as GISTNOVA OFFICIAL)
    window.submitReply = function(postId, commentId) {
        const formDiv = document.getElementById(`reply-form-${commentId}`);
        const textarea = formDiv.querySelector('textarea');
        const replyText = textarea.value.trim();
        if (!replyText) return;

        const replyData = {
            name: 'GISTNOVA OFFICIAL',
            comment: replyText,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            replyTo: commentId // optional, can be used for threading
        };

        commentsRef.child(postId).push(replyData)
        .then(() => {
            textarea.value = '';
            hideReplyForm(commentId);
            loadCommentsForPost(postId); // Refresh modal
            loadPostsTable(); // Update comment count
        })
        .catch(err => alert('Error posting reply: ' + err.message));
    };

    // Delete comment
    window.deleteComment = function(postId, commentId) {
        if (confirm('Delete this comment permanently?')) {
            commentsRef.child(postId).child(commentId).remove()
            .then(() => {
                loadCommentsForPost(postId);
                loadPostsTable(); // Update comment count
            })
            .catch(err => alert('Error deleting comment: ' + err.message));
        }
    };

    // Helper escape
    function escapeHtml(unsafe) {
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // --- 15. STATE PERSISTENCE (Local Storage) ---

    // Save form draft (create/edit)
    function saveFormDraft() {
        const draft = {
            postId: postIdToEditInput.value,
            title: document.getElementById("post-title").value,
            category: document.getElementById("post-category").value,
            description: document.getElementById("post-desc").value,
            content: document.getElementById("post-content").value,
            imageUrl: hiddenUrlInput.value,
            uploadStatus: statusText.innerHTML,
            progressWidth: progressFill.style.width
        };
        localStorage.setItem('adminFormDraft', JSON.stringify(draft));
    }

    function clearFormDraft() {
        localStorage.removeItem('adminFormDraft');
    }

    function restoreFormDraft() {
        const saved = localStorage.getItem('adminFormDraft');
        if (!saved) return;
        try {
            const draft = JSON.parse(saved);
            postIdToEditInput.value = draft.postId || '';
            document.getElementById("post-title").value = draft.title || '';
            document.getElementById("post-category").value = draft.category || 'Entertainment';
            document.getElementById("post-desc").value = draft.description || '';
            document.getElementById("post-content").value = draft.content || '';
            hiddenUrlInput.value = draft.imageUrl || '';
            if (draft.imageUrl) {
                statusText.innerHTML = draft.uploadStatus || '<i class="fas fa-check-circle"></i> Image Loaded';
                statusText.style.color = "var(--primary-color)";
                progressFill.style.width = draft.progressWidth || '100%';
                progressFill.style.backgroundColor = "var(--primary-color)";
            }
            if (draft.postId) {
                // Edit mode UI
                document.querySelector("#create-post .section-title").innerHTML = '<i class="fas fa-edit"></i> Edit Article';
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Gist';
                submitBtn.classList.add("edit-mode");
                form.classList.add("edit-mode");
            }
        } catch (e) {}
    }

    // Save manage page filters
    function saveManageState() {
        const state = {
            search: searchInput.value,
            category: categoryFilter.value,
            sort: sortFilter.value
        };
        localStorage.setItem('adminManageState', JSON.stringify(state));
    }

    function restoreManageState() {
        const saved = localStorage.getItem('adminManageState');
        if (!saved) return;
        try {
            const state = JSON.parse(saved);
            searchInput.value = state.search || '';
            categoryFilter.value = state.category || 'all';
            sortFilter.value = state.sort || 'newest';
            currentSearchTerm = state.search || '';
            currentFilterCategory = state.category || 'all';
            currentSortOption = state.sort || 'newest';
            clearSearch.classList.toggle('visible', currentSearchTerm.length > 0);
        } catch (e) {}
    }

    // Restore active tab
    function restoreActiveTab() {
        const savedTab = localStorage.getItem('adminActiveTab');
        if (savedTab && savedTab !== 'create-post') {
            document.querySelector(`.tab-btn[data-target="${savedTab}"]`).click();
        }
    }

    // Master restore
    function restoreState() {
        restoreFormDraft();
        restoreManageState();
        restoreActiveTab();
    }

    // Auto-save form on input
    const formInputs = document.querySelectorAll('#blog-form input, #blog-form select, #blog-form textarea');
    formInputs.forEach(input => {
        input.addEventListener('input', saveFormDraft);
    });

    // --- 16. RESET FORM ---
    function resetForm() {
        form.reset();
        postIdToEditInput.value = "";
        document.querySelector("#create-post .section-title").innerHTML = '<i class="fas fa-plus-circle"></i> Post a New Article';
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Gist';
        submitBtn.disabled = false;
        submitBtn.classList.remove("edit-mode");
        form.classList.remove("edit-mode");

        hiddenUrlInput.value = "";
        progressFill.style.width = "0%";
        progressFill.style.backgroundColor = "";
        statusText.innerHTML = '📷 Select Image';
        statusText.style.color = "inherit";
    }

    window.toggleHelp = function() {
        const guide = document.getElementById("formatting-guide");
        guide.style.display = guide.style.display === "block" ? "none" : "block";
    }
});