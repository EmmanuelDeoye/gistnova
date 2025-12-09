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
                loadPostsTable(); // Load the table immediately upon login
            }, 300);
        } else {
            errorMsg.textContent = "Incorrect passcode!";
            passInput.value = "";
            passInput.style.borderColor = "red";
        }
    });

    // --- 2. TAB NAVIGATION LOGIC ---
    const tabButtons = document.querySelectorAll(".tab-btn");
    const contentSections = document.querySelectorAll(".content-section");

    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            const targetId = button.getAttribute("data-target");

            // Deactivate all
            tabButtons.forEach(btn => btn.classList.remove("active"));
            contentSections.forEach(sec => sec.style.display = "none");

            // Activate current
            button.classList.add("active");
            document.getElementById(targetId).style.display = "block";

            // If navigating to Manage, refresh the table
            if (targetId === 'manage-posts') {
                loadPostsTable();
            }
        });
    });


    // --- 3. IMAGE UPLOAD LOGIC ---
    const fileInput = document.getElementById("image-file");
    const statusText = document.getElementById("upload-status");
    const hiddenUrlInput = document.getElementById("final-image-url");
    const progressFill = document.getElementById("progress-fill");

    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileName = Date.now() + "_" + file.name;
        
        // Use the initialized storage object from configuration.js
        const storageRef = firebase.storage().ref('blogImages/' + fileName);
        const uploadTask = storageRef.put(file);

        statusText.textContent = "Uploading...";
        statusText.style.color = "inherit"; // Reset color

        uploadTask.on('state_changed', 
            (snapshot) => {
                var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                progressFill.style.width = progress + "%";
            }, 
            (error) => {
                console.error("Upload failed:", error);
                statusText.textContent = "Error Uploading";
                statusText.style.color = "red";
                progressFill.style.width = "0%";
            }, 
            () => {
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    hiddenUrlInput.value = downloadURL;
                    statusText.textContent = "Upload Complete! 🟢";
                    statusText.style.color = "green";
                    statusText.style.fontWeight = "bold";
                });
            }
        );
    });

    // --- 4. FORM SUBMISSION (Create/Edit Logic) ---
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

        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        submitBtn.disabled = true;

        let postData = {
            title: title,
            category: category,
            description: desc,
            content: content,
            img: imgUrl,
        };

        let operationPromise;

        if (isEditing) {
            // Update existing post
            operationPromise = postsRef.child(postId).update(postData);
        } else {
            // Create new post
            postData.timestamp = firebase.database.ServerValue.TIMESTAMP;
            operationPromise = postsRef.push(postData);
        }

        operationPromise
        .then(() => {
            alert(`Gist ${isEditing ? 'Updated' : 'Published'} Successfully!`);
            resetForm();
            loadPostsTable(); // Refresh table after action
        })
        .catch((error) => {
            alert("Error: " + error.message);
            submitBtn.innerHTML = 'Try Again';
            submitBtn.disabled = false;
        });
    });

    // --- 5. EDIT/VIEW/DELETE FUNCTIONS ---

    window.editPost = function(postId) {
        // 1. Switch to Create/Edit Form Tab
        document.querySelector('.tab-btn[data-target="create-post"]').click();
        const sectionTitle = document.querySelector("#create-post .section-title");
        sectionTitle.textContent = "Edit Existing Article";
        
        // Change button style/text for editing
        submitBtn.innerHTML = '<i class="fas fa-edit"></i> Update Gist';
        submitBtn.classList.add("edit-mode");
        form.classList.add("edit-mode");

        // 2. Load Data
        postsRef.child(postId).once('value', (snapshot) => {
            const post = snapshot.val();
            if (post) {
                // Populate the hidden ID field
                postIdToEditInput.value = postId;
                
                // Populate Form Fields
                document.getElementById("post-title").value = post.title;
                document.getElementById("post-category").value = post.category;
                document.getElementById("post-desc").value = post.description;
                document.getElementById("post-content").value = post.content;
                
                // Handle Image URL
                hiddenUrlInput.value = post.img || "";
                statusText.textContent = post.img ? 'Image Loaded (Edit to change)' : 'No Image';
                statusText.style.color = post.img ? "blue" : "gray";
                progressFill.style.width = "100%";
            }
        });
    }

    window.deletePost = function(postId) {
        if (confirm("Are you sure you want to delete this post? This cannot be undone.")) {
            // 1. Delete Post Data
            postsRef.child(postId).remove()
            .then(() => {
                // 2. Delete View Count (Optional cleanup)
                viewsRef.child(postId).remove();
                alert("Post successfully deleted! 🗑️");
                loadPostsTable(); // Refresh the table
            })
            .catch((error) => {
                alert("Error deleting post: " + error.message);
            });
        }
    }


    // --- 6. POSTS TABLE LOADING ---

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
        
        // Ensure table headers match the new column count
        const thead = tableEl.querySelector('thead tr');
        thead.innerHTML = `
            <th>Image</th>
            <th>Title</th>
            <th>Category</th>
            <th>Date</th>
            <th>Views</th>
            <th>Actions</th>
        `;
        
        tbody.innerHTML = '';
        loadingEl.style.display = 'block';
        tableEl.style.display = 'none';

        // Fetch views first, then fetch posts
        fetchViewCounts().then(() => {
            postsRef.once('value', (snapshot) => {
                loadingEl.style.display = 'none';
                const data = snapshot.val();
                
                if (!data) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No posts found.</td></tr>';
                    return;
                }

                tableEl.style.display = 'table';
                
                // Convert object to array and reverse for newest first
                const postsArray = Object.entries(data).reverse();

                postsArray.forEach(([key, post]) => {
                    const views = allViewCounts[key] || 0;
                    const date = new Date(post.timestamp).toLocaleDateString();
                    const imgUrl = post.img || 'https://via.placeholder.com/60x40?text=No+Img';
                    
                    const row = tbody.insertRow();
                    
                    // The data-label attributes are crucial for mobile responsiveness
                    row.innerHTML = `
                        <td data-label="Image">
                            <img src="${imgUrl}" class="post-image" alt="Cover">
                        </td>
                        <td data-label="Title">${post.title}</td>
                        <td data-label="Category">${post.category}</td>
                        <td data-label="Date">${date}</td>
                        <td data-label="Views">${views}</td>
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
        
        // Reset button and titles
        document.querySelector("#create-post .section-title").textContent = "Post a New Article";
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Gist';
        submitBtn.disabled = false;
        submitBtn.classList.remove("edit-mode");
        form.classList.remove("edit-mode");

        // Reset image upload status
        hiddenUrlInput.value = "";
        progressFill.style.width = "0%";
        statusText.textContent = "Select Image";
        statusText.style.color = "inherit";
    }

    window.toggleHelp = function() {
        const guide = document.getElementById("formatting-guide");
        guide.style.display = (guide.style.display === "block") ? "none" : "block";
    }
});
