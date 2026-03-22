const productDetails = document.getElementById("productDetails");
const favoriteBtn = document.getElementById("favoriteBtn");
const productNotice = document.getElementById("productNotice");

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get("id");

let currentUser = null;
let currentProduct = null;
let isFavorite = false;
let contactSellerBtn = null;
let currentCarouselIndex = 0;
const contactModal = document.getElementById("contactModal");
const contactClose = document.getElementById("contactClose");
const contactForm = document.getElementById("contactForm");
const contactMeta = document.getElementById("contactMeta");

const getId = (value) => api.getEntityId(value);

const renderProductMedia = (images, safeTitle) => {
  const validImages = images.filter(Boolean);
  if (!validImages.length) {
    return `
      <div class="product-media">
        <div class="product-image">
          <div class="media-fallback">No image</div>
        </div>
      </div>
    `;
  }

  if (validImages.length === 1) {
    const imageUrl = ui.escapeHtml(validImages[0]);
    return `
      <div class="product-media">
        <div class="product-image">
          <img src="${imageUrl}" alt="${safeTitle}" loading="lazy" />
        </div>
      </div>
    `;
  }

  return `
    <div class="product-media">
      <div class="product-carousel" id="productCarousel" data-total="${validImages.length}">
        <div class="product-carousel-track" id="productCarouselTrack">
          ${validImages
            .map(
              (img) => `
              <div class="product-carousel-slide">
                <img src="${ui.escapeHtml(img)}" alt="${safeTitle}" loading="lazy" />
              </div>
            `,
            )
            .join("")}
        </div>
        <button class="carousel-nav prev" type="button" id="productCarouselPrev" aria-label="Previous image">‹</button>
        <button class="carousel-nav next" type="button" id="productCarouselNext" aria-label="Next image">›</button>
      </div>
      <div class="product-carousel-dots" id="productCarouselDots">
        ${validImages
          .map(
            (_, index) => `
            <button class="product-carousel-dot ${index === 0 ? "active" : ""}" type="button" data-carousel-index="${index}" aria-label="Go to image ${index + 1}"></button>
          `,
          )
          .join("")}
      </div>
    </div>
  `;
};

const initProductCarousel = () => {
  const carousel = document.getElementById("productCarousel");
  const track = document.getElementById("productCarouselTrack");
  if (!carousel || !track) {
    return;
  }

  const totalSlides = Number(carousel.dataset.total || 0);
  if (!totalSlides || totalSlides < 2) {
    return;
  }

  const setSlide = (index) => {
    currentCarouselIndex = (index + totalSlides) % totalSlides;
    track.style.transform = `translateX(-${currentCarouselIndex * 100}%)`;
    document.querySelectorAll(".product-carousel-dot").forEach((dot) => {
      const dotIndex = Number(dot.dataset.carouselIndex || 0);
      dot.classList.toggle("active", dotIndex === currentCarouselIndex);
    });
  };

  document
    .getElementById("productCarouselPrev")
    ?.addEventListener("click", () => setSlide(currentCarouselIndex - 1));
  document
    .getElementById("productCarouselNext")
    ?.addEventListener("click", () => setSlide(currentCarouselIndex + 1));

  document.querySelectorAll(".product-carousel-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      setSlide(Number(dot.dataset.carouselIndex || 0));
    });
  });

  setSlide(0);
};

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
    const canContactSeller =
      Boolean(getId(product.seller)) &&
      (!currentUser || getId(currentUser) !== getId(product.seller));

    productDetails.innerHTML = `
      <div class="product-layout">
        ${renderProductMedia(images, safeTitle)}
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
          ${
            canContactSeller
              ? `<div class="hero-cta">
                  <button class="btn" id="contactSellerBtn" type="button">
                    Contact seller
                  </button>
                </div>`
              : ""
          }
        </div>
      </div>
    `;

    contactSellerBtn = document.getElementById("contactSellerBtn");
    updateContactSeller();
    await syncFavoriteState();
    setupListingAction();
    initProductCarousel();
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
  if (isOwnerViewing() && productNotice) {
    productNotice.textContent = "This is your listing.";
  } else if (!currentUser && productNotice) {
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
    if (isOwnerViewing()) {
      ui.setNotice("productNotice", "You cannot contact yourself.");
      return;
    }
    openContactModal();
  }
});

init();
