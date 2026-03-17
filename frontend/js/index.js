const productGrid = document.getElementById("productGrid");
const filterForm = document.getElementById("filterForm");

const renderProducts = (products) => {
  if (!productGrid) {
    return;
  }

  productGrid.innerHTML = "";
  if (!products.length) {
    productGrid.innerHTML = "<div class='notice'>No listings found.</div>";
    return;
  }

  products.forEach((product) => {
    const imageUrl = ui.resolveImage(product.images);
    const safeImageUrl = ui.escapeHtml(imageUrl);
    const safeTitle = ui.escapeHtml(product.title);
    const safeCategory = ui.escapeHtml(product.category);
    const locationText =
      product.locationName ||
      [product.location?.city, product.location?.state]
        .filter(Boolean)
        .join(", ");
    const metaText = [product.condition, locationText].filter(Boolean).join(" - ");
    const card = document.createElement("div");
    card.className = "card fade-in";
    card.innerHTML = `
      <div class="card-media">
        ${
          imageUrl
            ? `<img src="${safeImageUrl}" alt="${safeTitle}" loading="lazy" />`
            : `<div class="media-fallback">No image</div>`
        }
      </div>
      <div class="card-body">
        <span class="tag">${safeCategory}</span>
        <h3>${safeTitle}</h3>
        <div class="price">${ui.currency(product.price)}</div>
        <div class="meta">${ui.escapeHtml(metaText || "Location unavailable")}</div>
        <a class="btn" href="/product.html?id=${product._id}">View</a>
      </div>
    `;
    productGrid.appendChild(card);
  });
};

const loadProducts = async (filters = {}) => {
  if (!productGrid) {
    return;
  }

  ui.showLoader("listLoader", true);
  try {
    const params = new URLSearchParams(filters);
    const products = await api.request(`/api/products?${params.toString()}`);
    renderProducts(products);
  } catch (error) {
    productGrid.innerHTML = `<div class='notice'>${error.message}</div>`;
  } finally {
    ui.showLoader("listLoader", false);
  }
};

if (filterForm) {
  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(filterForm);
    const filters = Object.fromEntries(formData.entries());
    loadProducts(filters);
  });
}

loadProducts();

