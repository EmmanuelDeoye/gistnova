document.addEventListener("DOMContentLoaded", () => {
    
    // --- FIREBASE REFERENCES ---
    const viewsRef = firebase.database().ref('postViews'); 
    const postsRef = firebase.database().ref('blogPosts'); 
    
    // --- 1. SECURITY CHECK ---
    const loginOverlay = document.getElementById("login-overlay");
    const loginBtn = document.getElementById("login-btn");
    const passInput = document.getElementById("passcode-input");
    const errorMsg = document.getElementById("error-msg");
    const adminPanel = document.getElementById("admin-panel");

    const SECRET_CODE = "4";

    loginBtn.addEventListener("click", () => {
        if (passInput.value === SECRET_CODE) {
            loginOverlay.style.opacity = "0";
            setTimeout(() => {
                loginOverlay.style.display = "none";
                adminPanel.style.display = "block";
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

    // Allow Enter key to submit
    passInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            loginBtn.click();
        }
    });

    // --- 2. TAB NAVIGATION LOGIC ---
    const tabButtons = document.querySelectorAll(".tab-btn");
    const contentSections = document.querySelectorAll(".content-section");

    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            const targetId = button.getAttribute("data-target");

            tabButtons.forEach(btn => btn.classList.remove("active"));
            contentSections.forEach(sec => sec.style.display = "none");

            button.classList.add("active");
            document.getElementById(targetId).style.display = "block";

            if (targetId === 'manage-posts') {
                loadPostsTable();
            }
        });
    });

    // --- 3. IMAGE UPLOAD LOGIC (Improved) ---
    const fileInput = document.getElementById("image-file");
    const statusText = document.getElementById("upload-status");
    const hiddenUrlInput = document.getElementById("final-image-url");
    const progressFill = document.getElementById("progress-fill");

    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.match('image.*')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB');
            return;
        }

        const fileName = Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        
        const storageRef = firebase.storage().ref('blogImages/' + fileName);
        const uploadTask = storageRef.put(file);

        statusText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        statusText.style.color = "inherit";

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                progressFill.style.width = progress + "%";
            }, 
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
                    statusText.style.fontWeight = "bold";
                    
                    // Show success animation
                    progressFill.style.backgroundColor = "var(--success)";
                });
            }
        );
    });

    // --- 4. FORM SUBMISSION (Updated for fullgist.js) ---
    const form = document.getElementById("blog-form");
    const submitBtn = document.getElementById("submit-btn");
    const postIdToEditInput = document.getElementById("post-id-to-edit");

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const postId = postIdToEditInput.value;
        const isEditing = !!postId;

        const title = document.getElementById("post-title").value;
        const category = document.getElementById("post-category").value;
        const desc = document.getElementById("post-desc").value;
        const content = document.getElementById("post-content").value;
        const imgUrl = hiddenUrlInput.value;

        // Validate required fields
        if (!title || !category || !desc || !content) {
            alert('Please fill in all required fields');
            return;
        }

        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        submitBtn.disabled = true;

        let postData = {
            title: title,
            category: category,
            description: desc,
            content: content,
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
            loadPostsTable();
            
            // Switch to manage tab after successful operation
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

    // --- 5. EDIT/VIEW/DELETE FUNCTIONS ---

    window.editPost = function(postId) {
        document.querySelector('.tab-btn[data-target="create-post"]').click();
        
        const sectionTitle = document.querySelector("#create-post .section-title");
        sectionTitle.textContent = "✏️ Edit Article";
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
            }
        });
    }

    window.deletePost = function(postId) {
        if (confirm("🗑️ Are you sure you want to delete this post? This cannot be undone.")) {
            const deleteBtn = event.target.closest('.delete-btn');
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            deleteBtn.disabled = true;

            postsRef.child(postId).remove()
            .then(() => {
                viewsRef.child(postId).remove();
                alert("✅ Post successfully deleted!");
                loadPostsTable();
            })
            .catch((error) => {
                alert("Error deleting post: " + error.message);
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
                deleteBtn.disabled = false;
            });
        }
    }

    // --- 6. POSTS TABLE LOADING (Updated) ---

    let allViewCounts = {};

    function fetchViewCounts() {
        return viewsRef.once('value').then(snapshot => {
            allViewCounts = snapshot.val() || {};
        });
    }

    function loadPostsTable() {
        const tbody = document.getElementById("posts-tbody");
        const loadingEl = document.getElementById("loading-posts");
        const tableEl = document.getElementById("posts-table");
        
        tbody.innerHTML = '';
        loadingEl.style.display = 'block';
        tableEl.style.display = 'none';

        fetchViewCounts().then(() => {
            postsRef.orderByChild('timestamp').once('value', (snapshot) => {
                loadingEl.style.display = 'none';
                const data = snapshot.val();
                
                if (!data) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px;">📭 No posts found. Create your first gist!</td></tr>';
                    tableEl.style.display = 'table';
                    return;
                }

                tableEl.style.display = 'table';
                
                const postsArray = Object.entries(data).reverse();

                postsArray.forEach(([key, post]) => {
                    if (!post) return;
                    
                    const views = allViewCounts[key] || 0;
                    const date = post.timestamp ? new Date(post.timestamp).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    }) : 'No date';
                    
                    const imgUrl = post.img || 'https://via.placeholder.com/80x60?text=No+Image';
                    
                    const row = tbody.insertRow();
                    
                    row.innerHTML = `
                        <td data-label="Image">
                            <img src="${imgUrl}" class="post-image" alt="Cover" loading="lazy" onerror="this.src='https://via.placeholder.com/80x60?text=Error';">
                        </td>
                        <td data-label="Title"><strong>${post.title || 'Untitled'}</strong></td>
                        <td data-label="Category"><span style="background:var(--primary-soft); color:var(--primary-color); padding:4px 12px; border-radius:20px; font-size:0.85rem;">${post.category || 'General'}</span></td>
                        <td data-label="Date">${date}</td>
                        <td data-label="Views"><i class="far fa-eye"></i> ${views.toLocaleString()}</td>
                        <td data-label="Actions">
                            <button class="action-btn" onclick="editPost('${key}')" title="Edit Post">
                                <i class="fas fa-pencil-alt"></i> Edit
                            </button>
                            <button class="action-btn delete-btn" onclick="deletePost('${key}')" title="Delete Post">
                                <i class="fas fa-trash-alt"></i> Delete
                            </button>
                            <a href="fullgist.html?id=${key}" target="_blank" class="action-btn" title="View Live Post">
                                <i class="fas fa-eye"></i> View
                            </a>
                        </td>
                    `;
                });
            });
        });
    }

    // --- 7. UTILITY FUNCTIONS ---

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

    // --- 8. Theme Toggle (Optional - Add if you want theme switcher in admin) ---
    // You can add a theme toggle button similar to the main site
});