const profileCard = document.getElementById("profileCard");
const listingsGrid = document.getElementById("listingsGrid");
const purchasesGrid = document.getElementById("purchasesGrid");
const favoritesGrid = document.getElementById("favoritesGrid");
const createForm = document.getElementById("createForm");

const renderListings = (listings) => {
  if (!listingsGrid) {
    return;
  }
  if (!listings.length) {
    listingsGrid.innerHTML =
      "<div class='notice'>You have no listings yet.</div>";
    return;
  }

  listingsGrid.innerHTML = listings
    .map((product) => {
      const imageUrl = ui.resolveImage(product.images);
      const safeImageUrl = ui.escapeHtml(imageUrl);
      const safeTitle = ui.escapeHtml(product.title);
      const statusText = ui.escapeHtml(product.status);
      const approvalText = product.isApproved ? "Approved" : "Pending review";
      const soldMeta = product.soldAt ? `Sold on ${ui.date(product.soldAt)}` : "";
      const buyerMeta = product.buyer?.name
        ? `Buyer: ${ui.escapeHtml(product.buyer.name)}`
        : product.status === "Sold"
          ? "Buyer not assigned"
          : "";
      const actions = [
        `<a class="btn secondary" href="/product.html?id=${product._id}">View</a>`,
      ];
      if (product.status !== "Sold" || !product.buyer) {
        const saleActionLabel =
          product.status === "Sold" ? "Assign buyer" : "Mark sold";
        actions.push(
          `<button class="btn secondary" data-mark-sold="${product._id}" data-title="${encodeURIComponent(
            product.title,
          )}" data-buyer-id="${product.buyer?._id || ""}">${saleActionLabel}</button>`,
        );
      }
      return `
      <div class="card">
        <div class="card-media">
          ${
            imageUrl
              ? `<img src="${safeImageUrl}" alt="${safeTitle}" loading="lazy" />`
              : `<div class="media-fallback">No image</div>`
          }
        </div>
        <div class="card-body">
          <h4>${safeTitle}</h4>
          <div class="price">${ui.currency(product.price)}</div>
          <div class="meta">${statusText} - ${approvalText}</div>
          ${buyerMeta ? `<div class="meta">${buyerMeta}</div>` : ""}
          ${soldMeta ? `<div class="meta">${ui.escapeHtml(soldMeta)}</div>` : ""}
          <div class="hero-cta">${actions.join("")}</div>
        </div>
      </div>
    `;
    })
    .join("");

  document.querySelectorAll("[data-mark-sold]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      sales.openMarkSold({
        productId: btn.dataset.markSold,
        title: decodeURIComponent(btn.dataset.title || "listing"),
        buyerId: btn.dataset.buyerId || "",
        onSuccess: async (result) => {
          ui.setNotice("dashNotice", result.message || "Listing marked as sold.");
          await loadDashboard();
        },
      });
    });
  });
};

const renderPurchases = (purchases) => {
  if (!purchasesGrid) {
    return;
  }

  if (!purchases.length) {
    purchasesGrid.innerHTML =
      "<div class='notice'>You have not purchased any items yet.</div>";
    return;
  }

  purchasesGrid.innerHTML = purchases
    .map((product) => {
      const imageUrl = ui.resolveImage(product.images);
      const safeImageUrl = ui.escapeHtml(imageUrl);
      const safeTitle = ui.escapeHtml(product.title);
      const sellerName = ui.escapeHtml(product.seller?.name || "Seller");
      const soldOn = product.soldAt ? ui.date(product.soldAt) : "";
      return `
      <div class="card">
        <div class="card-media">
          ${
            imageUrl
              ? `<img src="${safeImageUrl}" alt="${safeTitle}" loading="lazy" />`
              : `<div class="media-fallback">No image</div>`
          }
        </div>
        <div class="card-body">
          <h4>${safeTitle}</h4>
          <div class="price">${ui.currency(product.price)}</div>
          <div class="meta">Bought from ${sellerName}</div>
          ${soldOn ? `<div class="meta">Purchased on ${ui.escapeHtml(soldOn)}</div>` : ""}
          <div class="hero-cta">
            <a class="btn" href="/product.html?id=${product._id}">View</a>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
};

const renderFavorites = (favorites) => {
  if (!favoritesGrid) {
    return;
  }
  if (!favorites.length) {
    favoritesGrid.innerHTML =
      "<div class='notice'>No favorites saved yet.</div>";
    return;
  }

  favoritesGrid.innerHTML = favorites
    .map((fav) => {
      const imageUrl = ui.resolveImage(fav.product?.images || []);
      const safeImageUrl = ui.escapeHtml(imageUrl);
      const productId = api.getEntityId(fav.product);
      const locationText =
        fav.product?.locationName ||
        [fav.product?.location?.city, fav.product?.location?.state]
          .filter(Boolean)
          .join(", ");
      const safeTitle = ui.escapeHtml(fav.product?.title || "Listing");
      const safeLocationText = ui.escapeHtml(locationText || "Location unavailable");
      return `
      <div class="card">
        <div class="card-media">
          ${
            imageUrl
              ? `<img src="${safeImageUrl}" alt="${safeTitle}" loading="lazy" />`
              : `<div class="media-fallback">No image</div>`
          }
        </div>
        <div class="card-body">
          <h4>${safeTitle}</h4>
          <div class="meta">${safeLocationText}</div>
          <div class="hero-cta">
            <a class="btn" href="/product.html?id=${productId}">View</a>
            <button class="btn secondary" type="button" data-unfavorite="${productId}">
              Remove favorite
            </button>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  document.querySelectorAll("[data-unfavorite]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetProductId = btn.dataset.unfavorite;
      if (!targetProductId) {
        return;
      }

      try {
        await api.request(`/api/favorites/${targetProductId}`, {
          method: "DELETE",
        });
        ui.setNotice("dashNotice", "Removed from favorites.");
        loadDashboard();
      } catch (error) {
        ui.setNotice("dashNotice", error.message);
      }
    });
  });
};

const loadDashboard = async () => {
  ui.showLoader("dashLoader", true);
  try {
    const [me, listings, purchases, favorites] = await Promise.all([
      api.request("/api/users/me"),
      api.request("/api/users/me/listings"),
      api.request("/api/users/me/purchases"),
      api.request("/api/favorites"),
    ]);

    if (profileCard) {
      const identityLine = [me.email, me.phone].filter(Boolean).join(" - ");
      const locationLine = [me.location?.city, me.location?.state]
        .filter(Boolean)
        .join(", ");
      profileCard.innerHTML = `
        <div class="card">
          <h3>${ui.escapeHtml(me.name)}</h3>
          <div class="meta">${ui.escapeHtml(identityLine)}</div>
          <div class="meta">${ui.escapeHtml(locationLine)}</div>
        </div>
      `;
    }

    renderListings(listings);
    renderPurchases(purchases);
    renderFavorites(favorites);
  } catch (error) {
    ui.setNotice("dashNotice", error.message);
  } finally {
    ui.showLoader("dashLoader", false);
  }
};

if (createForm) {
  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(createForm);

    ui.showLoader("dashLoader", true);
    ui.setNotice("dashNotice", "");
    try {
      await api.request("/api/products", {
        method: "POST",
        body: formData,
      });
      createForm.reset();
      ui.setNotice("dashNotice", "Listing created and sent for approval.");
      loadDashboard();
    } catch (error) {
      ui.setNotice("dashNotice", error.message);
    } finally {
      ui.showLoader("dashLoader", false);
    }
  });
}

loadDashboard();
