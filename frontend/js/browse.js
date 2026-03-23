const productGrid = document.getElementById("productGrid");
const filterForm = document.getElementById("filterForm");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const browseCount = document.getElementById("browseCount");

const normalizeFilters = (filters = {}) =>
  Object.fromEntries(
    Object.entries(filters).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }
      return String(value).trim() !== "";
    }),
  );

const syncBrowseUrl = (filters = {}) => {
  const nextFilters = normalizeFilters(filters);
  const params = new URLSearchParams(nextFilters);
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
};

const getFiltersFromUrl = () =>
  Object.fromEntries(new URLSearchParams(window.location.search).entries());

const applyFiltersToForm = (filters = {}) => {
  if (!filterForm) {
    return;
  }
  Object.entries(filters).forEach(([key, value]) => {
    const field = filterForm.elements.namedItem(key);
    if (field) {
      field.value = value;
    }
  });
};

const renderProducts = (products) => {
  if (!productGrid) {
    return;
  }

  productGrid.innerHTML = "";

  if (browseCount) {
    browseCount.textContent = `${products.length} listing${
      products.length === 1 ? "" : "s"
    } found`;
  }

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
    const metaText = [product.condition, locationText]
      .filter(Boolean)
      .join(" - ");
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
    if (browseCount) {
      browseCount.textContent = "Could not load listings";
    }
    productGrid.innerHTML = `<div class='notice'>${ui.escapeHtml(error.message)}</div>`;
  } finally {
    ui.showLoader("listLoader", false);
  }
};

if (filterForm) {
  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(filterForm);
    const filters = normalizeFilters(Object.fromEntries(formData.entries()));
    syncBrowseUrl(filters);
    loadProducts(filters);
  });
}

if (clearFiltersBtn && filterForm) {
  clearFiltersBtn.addEventListener("click", () => {
    filterForm.reset();
    syncBrowseUrl({});
    loadProducts();
  });
}

const initialFilters = normalizeFilters(getFiltersFromUrl());
applyFiltersToForm(initialFilters);
loadProducts(initialFilters);
