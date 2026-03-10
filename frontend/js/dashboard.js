const profileCard = document.getElementById("profileCard");
const listingsGrid = document.getElementById("listingsGrid");
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
      return `
      <div class="card">
        <div class="card-media">
          ${
            imageUrl
              ? `<img src="${imageUrl}" alt="${product.title}" loading="lazy" />`
              : `<div class="media-fallback">No image</div>`
          }
        </div>
        <div class="card-body">
          <h4>${product.title}</h4>
          <div class="price">${ui.currency(product.price)}</div>
          <div class="meta">${product.status} - ${
            product.isApproved ? "Approved" : "Pending"
          }</div>
          <button class="btn secondary" data-sold="${product._id}">Mark sold</button>
        </div>
      </div>
    `;
    })
    .join("");

  document.querySelectorAll("[data-sold]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api.request(`/api/products/${btn.dataset.sold}/sold`, {
        method: "PATCH",
      });
      loadDashboard();
    });
  });
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
      const productId = api.getEntityId(fav.product);
      const locationText =
        fav.product?.locationName ||
        [fav.product?.location?.city, fav.product?.location?.state]
          .filter(Boolean)
          .join(", ");
      return `
      <div class="card">
        <div class="card-media">
          ${
            imageUrl
              ? `<img src="${imageUrl}" alt="${fav.product?.title || "Listing"}" loading="lazy" />`
              : `<div class="media-fallback">No image</div>`
          }
        </div>
        <div class="card-body">
          <h4>${fav.product?.title || "Listing"}</h4>
          <div class="meta">${locationText}</div>
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
    const [me, listings, favorites] = await Promise.all([
      api.request("/api/users/me"),
      api.request("/api/users/me/listings"),
      api.request("/api/favorites"),
    ]);

    if (profileCard) {
      profileCard.innerHTML = `
        <div class="card">
          <h3>${me.name}</h3>
          <div class="meta">${me.email || ""} ${me.phone ? "- " + me.phone : ""}</div>
          <div class="meta">${me.location?.city || ""} ${me.location?.state || ""}</div>
        </div>
      `;
    }

    renderListings(listings);
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
      loadDashboard();
    } catch (error) {
      ui.setNotice("dashNotice", error.message);
    } finally {
      ui.showLoader("dashLoader", false);
    }
  });
}

loadDashboard();
