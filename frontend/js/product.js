const productDetails = document.getElementById("productDetails");
const favoriteBtn = document.getElementById("favoriteBtn");
const productNotice = document.getElementById("productNotice");

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get("id");

let currentUser = null;
let currentProduct = null;
let isFavorite = false;
let contactSellerBtn = null;
const contactModal = document.getElementById("contactModal");
const contactClose = document.getElementById("contactClose");
const contactForm = document.getElementById("contactForm");
const contactMeta = document.getElementById("contactMeta");

const getId = (value) => api.getEntityId(value);

const isOwnerViewing = () => {
  if (!currentUser || !currentProduct) {
    return false;
  }
  return getId(currentUser) === getId(currentProduct.seller);
};

const isBuyerViewing = () => {
  if (!currentUser || !currentProduct) {
    return false;
  }
  return getId(currentUser) === getId(currentProduct.buyer);
};

const setupListingAction = () => {
  if (!favoriteBtn || !currentProduct) {
    return;
  }

  const isOwner = isOwnerViewing();
  const isSold = currentProduct.status === "Sold";

  if (isOwner) {
    favoriteBtn.textContent = !isSold
      ? "Mark as sold"
      : currentProduct.buyer
        ? "Update buyer"
        : "Assign buyer";
    favoriteBtn.classList.remove("secondary");
    favoriteBtn.classList.add("btn");
    favoriteBtn.disabled = false;
  } else if (isSold) {
    favoriteBtn.classList.add("secondary");
    favoriteBtn.textContent = isBuyerViewing()
      ? "Purchased item"
      : "Listing sold";
    favoriteBtn.disabled = true;
  } else {
    favoriteBtn.textContent = isFavorite
      ? "Remove from favorites"
      : "Save to favorites";
    favoriteBtn.classList.add("secondary");
    favoriteBtn.disabled = false;
  }
};

const syncFavoriteState = async () => {
  if (!currentProduct || !currentUser || isOwnerViewing()) {
    isFavorite = false;
    return;
  }

  const favorites = await api.request("/api/favorites");
  isFavorite = favorites.some(
    (fav) => getId(fav.product) === getId(currentProduct),
  );
};

const loadProduct = async () => {
  if (!productDetails || !productId) {
    return;
  }

  ui.showLoader("productLoader", true);
  try {
    const product = await api.request(`/api/products/${productId}`);
    currentProduct = product;
    const images = Array.isArray(product.images) ? product.images : [];
    const primaryImage = ui.resolveImage(images);
    const safePrimaryImage = ui.escapeHtml(primaryImage);
    const locationText =
      product.locationName ||
      [product.location?.city, product.location?.state]
        .filter(Boolean)
        .join(", ");
    const safeTitle = ui.escapeHtml(product.title);
    const safeCategory = ui.escapeHtml(product.category);
    const safeDescription = ui.escapeHtml(product.description);
    const sellerLine = [
      product.seller?.name || "Unknown",
      product.seller?.phone || "",
    ]
      .filter(Boolean)
      .join(" - ");
    const thumbnails = images
      .filter((img) => img && img !== primaryImage)
      .slice(0, 4)
      .map(
        (img) =>
          `<button class="thumb" type="button" data-image="${ui.escapeHtml(img)}">
            <img src="${ui.escapeHtml(img)}" alt="${safeTitle}" loading="lazy" />
          </button>`,
      )
      .join("");
    productDetails.innerHTML = `
      <div class="product-layout">
        <div class="product-media">
          <div class="product-image" id="primaryImage">
            ${
              primaryImage
                ? `<img src="${safePrimaryImage}" alt="${safeTitle}" />`
                : `<div class="media-fallback">No image</div>`
            }
          </div>
          ${thumbnails ? `<div class="product-thumbs">${thumbnails}</div>` : ""}
        </div>
        <div class="product-info">
          <span class="tag">${safeCategory}</span>
          <h2>${safeTitle}</h2>
          <div class="price">${ui.currency(product.price)}</div>
          <p>${safeDescription}</p>
          <div class="meta">${ui.escapeHtml(
            [product.condition, locationText].filter(Boolean).join(" - "),
          )}</div>
          <div class="meta">Seller: ${ui.escapeHtml(sellerLine)}</div>
          ${
            product.buyer
              ? `<div class="meta">Buyer: ${ui.escapeHtml(
                  product.buyer.name || "Assigned buyer",
                )}</div>`
              : ""
          }
          ${
            product.soldAt
              ? `<div class="meta">Sold on ${ui.escapeHtml(
                  ui.date(product.soldAt),
                )}</div>`
              : ""
          }
          <div class="hero-cta">
            <button class="btn" id="contactSellerBtn" type="button">
              Contact seller
            </button>
          </div>
        </div>
      </div>
    `;

    contactSellerBtn = document.getElementById("contactSellerBtn");
    updateContactSeller();
    await syncFavoriteState();
    setupListingAction();

    if (thumbnails) {
      document
        .querySelectorAll(".product-thumbs [data-image]")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            const image = btn.dataset.image;
            const target = document.getElementById("primaryImage");
            if (target) {
              target.innerHTML = `<img src="${ui.escapeHtml(
                image,
              )}" alt="${safeTitle}" />`;
            }
          });
        });
    }
  } catch (error) {
    productDetails.innerHTML = `<div class='notice'>${error.message}</div>`;
  } finally {
    ui.showLoader("productLoader", false);
  }
};

const updateContactSeller = () => {
  if (!contactSellerBtn || !currentProduct) {
    return;
  }

  if (!currentUser) {
    contactSellerBtn.style.display = "";
    return;
  }

  const sellerId = getId(currentProduct.seller);
  const isOwner = sellerId && sellerId === getId(currentUser);
  if (isOwner) {
    contactSellerBtn.style.display = "none";
    return;
  }

  contactSellerBtn.style.display = sellerId ? "" : "none";
};

const openContactModal = () => {
  if (!contactModal || !currentProduct || !contactMeta) {
    return;
  }
  const sellerName = currentProduct.seller?.name || "Seller";
  contactMeta.textContent = `Message to ${sellerName} about ${currentProduct.title}.`;
  contactModal.classList.add("open");
  ui.setNotice("contactNotice", "");
};

const closeContactModal = () => {
  if (!contactModal) {
    return;
  }
  contactModal.classList.remove("open");
};

if (favoriteBtn) {
  favoriteBtn.addEventListener("click", async () => {
    if (!currentProduct) {
      return;
    }

    const isOwner = isOwnerViewing();
    try {
      if (isOwner) {
        await sales.openMarkSold({
          productId,
          title: currentProduct.title,
          buyerId: currentProduct.buyer?._id || "",
          onSuccess: async (result) => {
            if (result.product) {
              currentProduct = result.product;
            } else {
              currentProduct.status = "Sold";
            }
            await loadProduct();
            setupListingAction();
            ui.setNotice(
              "productNotice",
              result.message || "Listing marked as sold.",
            );
          },
        });
        return;
      }

      if (!currentUser) {
        window.location.href = "/login.html";
        return;
      }

      if (currentProduct.status === "Sold") {
        return;
      }

      if (isFavorite) {
        await api.request(`/api/favorites/${productId}`, { method: "DELETE" });
        isFavorite = false;
        setupListingAction();
        ui.setNotice("productNotice", "Removed from favorites");
        return;
      }

      await api.request(`/api/favorites/${productId}`, { method: "POST" });
      isFavorite = true;
      setupListingAction();
      ui.setNotice("productNotice", "Saved to favorites");
    } catch (error) {
      ui.setNotice("productNotice", error.message);
    }
  });
}

const init = async () => {
  currentUser = await auth.ensureUser();
  await loadProduct();
  updateContactSeller();
  if (!currentUser && productNotice) {
    productNotice.textContent = "Log in to save this listing.";
  } else if (isBuyerViewing() && productNotice) {
    productNotice.textContent = "This listing is in your purchased items.";
  }
};

if (contactClose) {
  contactClose.addEventListener("click", closeContactModal);
}

if (contactModal) {
  contactModal.addEventListener("click", (event) => {
    if (event.target === contactModal) {
      closeContactModal();
    }
  });
}

if (contactForm) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser) {
      window.location.href = "/login.html";
      return;
    }
    const sellerId = getId(currentProduct?.seller);
    if (!sellerId) {
      return;
    }
    ui.showLoader("contactLoader", true);
    ui.setNotice("contactNotice", "");
    const payload = Object.fromEntries(new FormData(contactForm).entries());
    payload.productId = currentProduct._id;
    payload.recipientId = sellerId;

    if (getId(payload.recipientId) === getId(currentUser)) {
      ui.setNotice("contactNotice", "You cannot message yourself.");
      ui.showLoader("contactLoader", false);
      return;
    }

    try {
      await api.request("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      contactForm.reset();
      closeContactModal();
      window.location.href = `/messages.html?productId=${currentProduct._id}&userId=${sellerId}`;
    } catch (error) {
      ui.setNotice("contactNotice", error.message);
    } finally {
      ui.showLoader("contactLoader", false);
    }
  });
}

document.addEventListener("click", (event) => {
  if (event.target?.id === "contactSellerBtn") {
    if (!currentUser) {
      window.location.href = "/login.html";
      return;
    }
    openContactModal();
  }
});

init();
