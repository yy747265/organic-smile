const ADMIN_API_URL = "http://127.0.0.1:8000/admin/products";

// 1. FETCH FROM DB: This function gets all products from the database and displays them
async function loadAdminProducts() {
    const productsList = document.getElementById("productsList");
    if (!productsList) return;

    try {
        const response = await fetch(ADMIN_API_URL);
        const products = await response.json();
        
        productsList.innerHTML = ""; // Clear the loading state
        
        products.forEach(product => {
            const row = document.createElement("div");
            row.className = "item-row";
            const catName = product.category === 'dried' ? 'فواكه مجففة' : 'بودر طبيعي';
            
            row.innerHTML = `
                <div>
                    <span class="category-badge">${catName}</span>
                    <strong>${product.name}</strong>
                </div>
                <button type="button" class="btn-delete" onclick="deleteProduct('${product.name}')">
                    <i class="fa-solid fa-trash"></i> حذف
                </button>
            `;
            productsList.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading products:", error);
        productsList.innerHTML = "<p style='color:red;'>تعذر الاتصال بقاعدة البيانات. تأكد من تشغيل الخادم.</p>";
    }
}

// 2. DELETE FROM DB: This function removes a product when the delete button is clicked
window.deleteProduct = async function(productName) {
    if (!confirm(`هل أنت متأكد من حذف: ${productName}؟`)) return;

    try {
        const response = await fetch(`${ADMIN_API_URL}/${encodeURIComponent(productName)}`, {
            method: "DELETE"
        });
        
        if (response.ok) {
            alert("تم الحذف بنجاح!");
            loadAdminProducts(); // Instantly fetch the new list from the DB
        } else {
            alert("حدث خطأ أثناء الحذف.");
        }
    } catch (error) {
        console.error("Error deleting product:", error);
    }
};

// 3. ADD TO DB: Wait for the page to load, then setup the add form
document.addEventListener("DOMContentLoaded", () => {
    
    // Fetch and show products the moment admin.html is opened
    loadAdminProducts();
    
    // Logic for adding dynamic size rows
    const addSizeBtn = document.getElementById("addSizeBtn");
    const sizesContainer = document.getElementById("sizesContainer");
    
    if (addSizeBtn) {
        addSizeBtn.addEventListener("click", () => {
            const newRow = document.createElement("div");
            newRow.className = "size-row";
            newRow.innerHTML = `
                <input type="text" placeholder="الحجم (مثال: 250 جرام)" class="size-name" required>
                <input type="number" placeholder="السعر (ج.م)" class="size-price" required>
            `;
            sizesContainer.appendChild(newRow);
        });
    }

    // Logic for submitting the new product form
    const addProductForm = document.getElementById("addProductForm");
    
    if (addProductForm) {
        addProductForm.addEventListener("submit", async (e) => {
            e.preventDefault(); 
            
            const name = document.getElementById("pName").value;
            const category = document.getElementById("pCategory").value;
            
            const sizeRows = document.querySelectorAll(".size-row");
            const sizesArray = [];
            sizeRows.forEach(row => {
                const sizeName = row.querySelector(".size-name").value;
                const sizePrice = row.querySelector(".size-price").value;
                if (sizeName && sizePrice) {
                    sizesArray.push(`${sizeName} - ${sizePrice} EGP`); 
                }
            });

            const fileInput = document.getElementById("pFiles");
            const imagesArray = [];
            if (fileInput.files.length > 0) {
                Array.from(fileInput.files).forEach(file => {
                    imagesArray.push(`images/${file.name}`);
                });
            }

            const productData = {
                name: name,
                description: "", 
                category: category,
                sizes: sizesArray,
                images: imagesArray,
                isActive: true
            };

            try {
                const response = await fetch(ADMIN_API_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(productData)
                });
                
                if (response.ok) {
                    alert("تم إضافة المنتج بنجاح!");
                    addProductForm.reset(); 
                    document.getElementById("previewProduct").innerHTML = ""; 
                    loadAdminProducts(); // Instantly fetch the new list from the DB to show the added item
                } else {
                    alert("حدث خطأ أثناء الحفظ. تحقق من الخادم.");
                }
            } catch (error) {
                console.error("Fetch Error:", error);
                alert("تأكد من تشغيل الخادم المحلي (FastAPI).");
            }
        });
    }
});