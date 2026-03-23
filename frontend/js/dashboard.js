const profileCard = document.getElementById("profileCard");
const listingsGrid = document.getElementById("listingsGrid");
const purchasesGrid = document.getElementById("purchasesGrid");
const favoritesGrid = document.getElementById("favoritesGrid");
const analyticsGrid = document.getElementById("analyticsGrid");
const createForm = document.getElementById("createForm");
const createListingModalTitle = document.getElementById(
  "createListingModalTitle",
);
const createListingSubmitBtn = document.getElementById(
  "createListingSubmitBtn",
);
const listingExistingImages = document.getElementById("listingExistingImages");
const openCreateListingModalBtn = document.getElementById(
  "openCreateListingModal",
);
const createListingModal = document.getElementById("createListingModal");
const createListingModalClose = document.getElementById(
  "createListingModalClose",
);
const createListingModalCancel = document.getElementById(
  "createListingModalCancel",
);
const listingsCount = document.getElementById("listingsCount");
const favoritesCount = document.getElementById("favoritesCount");
const activeListingsStat = document.getElementById("activeListingsStat");
const messagesStat = document.getElementById("messagesStat");
const favoritesStat = document.getElementById("favoritesStat");
let editingListingId = "";
let editableListingsById = new Map();
let editableListingImages = [];
let removedImagePublicIds = new Set();
let draggingImagePublicId = "";
let isListingSubmitInFlight = false;

const reorderEditableImages = (fromPublicId, toPublicId) => {
  if (!fromPublicId || !toPublicId || fromPublicId === toPublicId) {
    return;
  }

  const fromIndex = editableListingImages.findIndex(
    (image) => image.publicId === fromPublicId,
  );
  const toIndex = editableListingImages.findIndex(
    (image) => image.publicId === toPublicId,
  );

  if (fromIndex < 0 || toIndex < 0) {
    return;
  }

  const [moved] = editableListingImages.splice(fromIndex, 1);
  editableListingImages.splice(toIndex, 0, moved);
};

const moveEditableImageByOffset = (publicId, offset) => {
  if (!publicId || !offset) {
    return;
  }

  const index = editableListingImages.findIndex(
    (image) => image.publicId === publicId,
  );
  if (index < 0) {
    return;
  }

  const targetIndex = index + offset;
  if (targetIndex < 0 || targetIndex >= editableListingImages.length) {
    return;
  }

  const [moved] = editableListingImages.splice(index, 1);
  editableListingImages.splice(targetIndex, 0, moved);
};

const renderEditableImages = () => {
  if (!listingExistingImages) {
    return;
  }

  if (!editingListingId || !editableListingImages.length) {
    listingExistingImages.hidden = true;
    listingExistingImages.innerHTML = "";
    return;
  }

  listingExistingImages.hidden = false;
  listingExistingImages.innerHTML = `
    <p class="meta" style="margin: 0 0 4px 0;">Existing photos (click Remove to exclude from update):</p>
    <p class="meta" style="margin: 0 0 10px 0;">Drag photos horizontally/vertically to reorder. First kept photo becomes primary.</p>
    <div class="listing-existing-images-grid">
      ${editableListingImages
        .map((image, index) => {
          const removed = removedImagePublicIds.has(image.publicId);
          const disableLeft = index === 0 ? "disabled" : "";
          const disableRight =
            index === editableListingImages.length - 1 ? "disabled" : "";
          return `
            <div class="listing-existing-image ${removed ? "removed" : ""}" draggable="true" data-image-public-id="${ui.escapeHtml(image.publicId)}">
              <img src="${ui.escapeHtml(image.url)}" alt="Listing image" loading="lazy" />
              <div class="listing-image-order-actions">
                <button class="btn secondary listing-image-order-btn" type="button" data-move-image="${ui.escapeHtml(image.publicId)}" data-move-offset="-1" ${disableLeft}>←</button>
                <button class="btn secondary listing-image-order-btn" type="button" data-move-image="${ui.escapeHtml(image.publicId)}" data-move-offset="1" ${disableRight}>→</button>
              </div>
              <button class="btn secondary listing-image-toggle" type="button" data-toggle-image="${ui.escapeHtml(image.publicId)}">
                ${removed ? "Keep" : "Remove"}
              </button>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  listingExistingImages
    .querySelectorAll("[data-toggle-image]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const publicId = button.dataset.toggleImage;
        if (!publicId) {
          return;
        }
        if (removedImagePublicIds.has(publicId)) {
          removedImagePublicIds.delete(publicId);
        } else {
          removedImagePublicIds.add(publicId);
        }
        renderEditableImages();
      });
    });

  listingExistingImages
    .querySelectorAll("[data-move-image]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const publicId = button.dataset.moveImage;
        const offset = Number(button.dataset.moveOffset || 0);
        moveEditableImageByOffset(publicId, offset);
        renderEditableImages();
      });
    });

  listingExistingImages
    .querySelectorAll(".listing-existing-image")
    .forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        const publicId = card.dataset.imagePublicId;
        if (!publicId) {
          return;
        }
        draggingImagePublicId = publicId;
        card.classList.add("dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", publicId);
        }
      });

      card.addEventListener("dragover", (event) => {
        event.preventDefault();
        card.classList.add("drag-over");
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("drag-over");
      });

      card.addEventListener("drop", (event) => {
        event.preventDefault();
        const targetPublicId = card.dataset.imagePublicId;
        const sourcePublicId =
          draggingImagePublicId ||
          event.dataTransfer?.getData("text/plain") ||
          "";
        card.classList.remove("drag-over");
        reorderEditableImages(sourcePublicId, targetPublicId);
        draggingImagePublicId = "";
        renderEditableImages();
      });

      card.addEventListener("dragend", () => {
        draggingImagePublicId = "";
        card.classList.remove("dragging", "drag-over");
        listingExistingImages
          .querySelectorAll(".listing-existing-image")
          .forEach((node) => node.classList.remove("drag-over", "dragging"));
      });
    });
};

const syncListingModalMode = () => {
  const isEditing = Boolean(editingListingId);
  if (createListingModalTitle) {
    createListingModalTitle.textContent = isEditing
      ? "Edit Listing"
      : "Create New Listing";
  }
  if (createListingSubmitBtn) {
    createListingSubmitBtn.textContent = isEditing
      ? "Save Changes"
      : "Publish Listing";
  }
};

const setListingSubmitPending = (pending) => {
  if (!createListingSubmitBtn) {
    return;
  }

  createListingSubmitBtn.disabled = pending;
  if (pending) {
    createListingSubmitBtn.textContent = editingListingId
      ? "Saving..."
      : "Publishing...";
  } else {
    syncListingModalMode();
  }
};

const resetListingFormToCreate = () => {
  editingListingId = "";
  editableListingImages = [];
  removedImagePublicIds.clear();
  if (createForm) {
    createForm.reset();
  }
  renderEditableImages();
  syncListingModalMode();
};

const prefillListingForm = (product) => {
  if (!createForm || !product) {
    return;
  }

  createForm.elements.title.value = product.title || "";
  createForm.elements.description.value = product.description || "";
  createForm.elements.category.value = product.category || "";
  createForm.elements.price.value = product.price ?? "";
  createForm.elements.condition.value = product.condition || "";
  createForm.elements.city.value = product.location?.city || "";
  createForm.elements.state.value = product.location?.state || "";
  createForm.elements.locationName.value = product.locationName || "";
  if (createForm.elements.images) {
    createForm.elements.images.value = "";
  }

  const existingUrls = Array.isArray(product.images) ? product.images : [];
  const existingPublicIds = Array.isArray(product.imagePublicIds)
    ? product.imagePublicIds
    : [];
  editableListingImages = existingUrls
    .map((url, index) => ({
      url,
      publicId: existingPublicIds[index] || "",
    }))
    .filter((image) => image.url && image.publicId);
  removedImagePublicIds.clear();
  renderEditableImages();
};

const renderAnalytics = ({ listings, purchases, favorites, messagesCount }) => {
  if (!analyticsGrid) {
    return;
  }

  const soldListings = listings.filter((item) => item.status === "Sold").length;
  const pendingListings = listings.filter((item) => !item.isApproved).length;
  const cards = [
    {
      icon: "📦",
      value: listings.length,
      label: "Total listings",
      trend: `${pendingListings} pending review`,
      trendClass: pendingListings > 0 ? "down" : "up",
    },
    {
      icon: "🛒",
      value: purchases.length,
      label: "Items purchased",
      trend: "Your completed purchases",
      trendClass: "up",
    },
    {
      icon: "💬",
      value: messagesCount,
      label: "Messages",
      trend: "Conversation activity",
      trendClass: "up",
    },
    {
      icon: "✅",
      value: soldListings,
      label: "Sold listings",
      trend: `${favorites.length} favorites saved`,
      trendClass: "up",
    },
  ];

  analyticsGrid.innerHTML = cards
    .map(
      (card) => `
      <article class="analytics-card">
        <div class="analytics-card-header">
          <span class="analytics-icon">${card.icon}</span>
          <span class="analytics-card-change ${card.trendClass}">${ui.escapeHtml(card.trend)}</span>
        </div>
        <p class="analytics-card-value">${ui.escapeHtml(String(card.value))}</p>
        <p class="analytics-card-label">${ui.escapeHtml(card.label)}</p>
      </article>
    `,
    )
    .join("");
};

const openCreateListingModal = ({ product } = {}) => {
  if (!createListingModal) {
    return;
  }

  if (product?._id) {
    editingListingId = product._id;
    prefillListingForm(product);
  } else {
    resetListingFormToCreate();
  }
  syncListingModalMode();

  createListingModal.classList.add("open");
  createListingModal.setAttribute("aria-hidden", "false");
};

const closeCreateListingModal = () => {
  if (!createListingModal) {
    return;
  }
  createListingModal.classList.remove("open");
  createListingModal.setAttribute("aria-hidden", "true");
  resetListingFormToCreate();
};

const renderListings = (listings) => {
  if (!listingsGrid) {
    return;
  }

  editableListingsById = new Map(
    listings.map((listing) => [String(listing._id), listing]),
  );

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
      const soldMeta = product.soldAt
        ? `Sold on ${ui.date(product.soldAt)}`
        : "";
      const buyerMeta = product.buyer?.name
        ? `Buyer: ${ui.escapeHtml(product.buyer.name)}`
        : product.status === "Sold"
          ? "Buyer not assigned"
          : "";
      const actions = [
        `<a class="btn secondary" href="/product.html?id=${product._id}">View</a>`,
        `<button class="btn secondary" type="button" data-edit-listing="${product._id}">Edit</button>`,
        `<button class="btn secondary" type="button" data-delete-listing="${product._id}" data-title="${encodeURIComponent(
          product.title,
        )}">Delete</button>`,
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
          ui.setNotice(
            "dashNotice",
            result.message || "Listing marked as sold.",
          );
          await loadDashboard();
        },
      });
    });
  });

  document.querySelectorAll("[data-edit-listing]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const listingId = btn.dataset.editListing;
      if (!listingId) {
        return;
      }
      const listing = editableListingsById.get(String(listingId));
      if (!listing) {
        ui.setNotice("dashNotice", "Could not load listing for editing.");
        return;
      }
      openCreateListingModal({ product: listing });
    });
  });

  document.querySelectorAll("[data-delete-listing]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const listingId = btn.dataset.deleteListing;
      if (!listingId) {
        return;
      }

      const title = decodeURIComponent(btn.dataset.title || "this listing");
      const shouldDelete = window.confirm(
        `Delete "${title}"? This action cannot be undone.`,
      );
      if (!shouldDelete) {
        return;
      }

      ui.showLoader("dashLoader", true);
      ui.setNotice("dashNotice", "");
      try {
        const result = await api.request(`/api/products/${listingId}`, {
          method: "DELETE",
        });
        ui.setNotice("dashNotice", result.message || "Listing removed.");
        await loadDashboard();
      } catch (error) {
        ui.setNotice("dashNotice", error.message);
      } finally {
        ui.showLoader("dashLoader", false);
      }
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
      const safeLocationText = ui.escapeHtml(
        locationText || "Location unavailable",
      );
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
    const [me, listings, purchases, favorites, messages] = await Promise.all([
      api.request("/api/users/me"),
      api.request("/api/users/me/listings"),
      api.request("/api/users/me/purchases"),
      api.request("/api/favorites"),
      api.request("/api/messages").catch(() => []),
    ]);

    const messagesCount = Array.isArray(messages) ? messages.length : 0;

    if (listingsCount) {
      listingsCount.textContent = `${listings.length} listing${
        listings.length === 1 ? "" : "s"
      }`;
    }
    if (favoritesCount) {
      favoritesCount.textContent = `${favorites.length} favorite${
        favorites.length === 1 ? "" : "s"
      }`;
    }
    if (activeListingsStat) {
      activeListingsStat.textContent = String(listings.length);
    }
    if (messagesStat) {
      messagesStat.textContent = String(messagesCount);
    }
    if (favoritesStat) {
      favoritesStat.textContent = String(favorites.length);
    }

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
    renderAnalytics({ listings, purchases, favorites, messagesCount });
  } catch (error) {
    ui.setNotice("dashNotice", error.message);
  } finally {
    ui.showLoader("dashLoader", false);
  }
};

if (createForm) {
  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isListingSubmitInFlight) {
      return;
    }

    isListingSubmitInFlight = true;
    setListingSubmitPending(true);

    const formData = new FormData(createForm);
    const isEditing = Boolean(editingListingId);
    const endpoint = isEditing
      ? `/api/products/${editingListingId}`
      : "/api/products";
    const method = isEditing ? "PATCH" : "POST";

    if (isEditing) {
      const keepImagePublicIds = editableListingImages
        .map((image) => image.publicId)
        .filter((publicId) => publicId && !removedImagePublicIds.has(publicId));
      formData.append("keepImagePublicIds", JSON.stringify(keepImagePublicIds));
    }

    ui.showLoader("dashLoader", true);
    ui.setNotice("dashNotice", "");
    try {
      await api.request(endpoint, {
        method,
        body: formData,
      });

      closeCreateListingModal();
      ui.setNotice(
        "dashNotice",
        isEditing
          ? "Listing updated successfully."
          : "Listing created and sent for approval.",
      );
      loadDashboard();
    } catch (error) {
      ui.setNotice("dashNotice", error.message);
    } finally {
      ui.showLoader("dashLoader", false);
      isListingSubmitInFlight = false;
      setListingSubmitPending(false);
    }
  });
}

if (openCreateListingModalBtn) {
  openCreateListingModalBtn.addEventListener("click", () =>
    openCreateListingModal(),
  );
}

if (createListingModalClose) {
  createListingModalClose.addEventListener("click", closeCreateListingModal);
}

if (createListingModalCancel) {
  createListingModalCancel.addEventListener("click", closeCreateListingModal);
}

if (createListingModal) {
  createListingModal.addEventListener("click", (event) => {
    if (event.target === createListingModal) {
      closeCreateListingModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCreateListingModal();
  }
});

const createFromQuery = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("create") !== "1") {
    return;
  }

  openCreateListingModal();
  params.delete("create");
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", nextUrl);
};

loadDashboard();
createFromQuery();
