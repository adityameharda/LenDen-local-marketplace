const listingsGrid = document.getElementById("myListingsGrid");

const loadListings = async () => {
  ui.showLoader("myListingsLoader", true);
  ui.setNotice("myListingsNotice", "");
  try {
    const user = await auth.ensureUser();
    if (!user) {
      ui.setNotice("myListingsNotice", "Please log in to view your listings.");
      return;
    }
    if (!listingsGrid) {
      return;
    }

    const listings = await api.request("/api/users/me/listings");

    if (!listings.length) {
      listingsGrid.innerHTML =
        "<div class='notice'>You have not created any listings yet.</div>";
      return;
    }

    listingsGrid.innerHTML = listings
      .map((product) => {
        const imageUrl = ui.resolveImage(product.images);
        const safeImageUrl = ui.escapeHtml(imageUrl);
        const safeTitle = ui.escapeHtml(product.title);
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
          <div class="meta">${ui.escapeHtml(product.status)} - ${approvalText}</div>
          ${buyerMeta ? `<div class="meta">${buyerMeta}</div>` : ""}
          ${soldMeta ? `<div class="meta">${ui.escapeHtml(soldMeta)}</div>` : ""}
          <div class="meta">${ui.escapeHtml(product.condition)}</div>
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
              "myListingsNotice",
              result.message || "Listing marked as sold.",
            );
            await loadListings();
          },
        });
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

        ui.showLoader("myListingsLoader", true);
        ui.setNotice("myListingsNotice", "");
        try {
          const result = await api.request(`/api/products/${listingId}`, {
            method: "DELETE",
          });
          ui.setNotice(
            "myListingsNotice",
            result.message || "Listing removed.",
          );
          await loadListings();
        } catch (error) {
          ui.setNotice("myListingsNotice", error.message);
        } finally {
          ui.showLoader("myListingsLoader", false);
        }
      });
    });
  } catch (error) {
    ui.setNotice("myListingsNotice", error.message);
  } finally {
    ui.showLoader("myListingsLoader", false);
  }
};

loadListings();
