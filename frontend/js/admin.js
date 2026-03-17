const statsGrid = document.getElementById("statsGrid");
const userTable = document.getElementById("userTable");
const listingTable = document.getElementById("listingTable");

const loadAdmin = async () => {
  if (!statsGrid || !userTable || !listingTable) {
    return;
  }

  ui.showLoader("adminLoader", true);
  try {
    const currentUser = await auth.ensureUser();
    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    const [stats, users, listings] = await Promise.all([
      api.request("/api/admin/stats"),
      api.request("/api/admin/users"),
      api.request("/api/admin/listings"),
    ]);

    statsGrid.innerHTML = `
      <div class="card"><h4>Users</h4><div class="price">${stats.users}</div></div>
      <div class="card"><h4>Listings</h4><div class="price">${stats.listings}</div></div>
      <div class="card"><h4>Pending</h4><div class="price">${stats.pendingListings}</div></div>
      <div class="card"><h4>Blocked</h4><div class="price">${stats.blockedUsers}</div></div>
    `;

    userTable.innerHTML = users
      .map(
        (user) => `
        <tr>
          <td>${ui.escapeHtml(user.name)}</td>
          <td>${ui.escapeHtml(user.email || "")}</td>
          <td>${ui.escapeHtml(user.phone || "")}</td>
          <td>${user.isBlocked ? "Blocked" : "Active"}</td>
          <td>
            <button class="btn secondary" data-block="${user._id}">${
              user.isBlocked ? "Unblock" : "Block"
            }</button>
          </td>
        </tr>
      `,
      )
      .join("");

    listingTable.innerHTML = listings
      .map((listing) => {
        const statusPill = listing.isApproved
          ? '<span class="status-pill approved">Approved</span>'
          : '<span class="status-pill pending">Pending</span>';
        const approveButton = listing.isApproved
          ? ""
          : `<button class="btn secondary" data-approve="${listing._id}">Approve</button>`;
        return `
        <tr>
          <td>${ui.escapeHtml(listing.title)}</td>
          <td>${ui.escapeHtml(listing.category)}</td>
          <td>${statusPill}</td>
          <td>
            ${approveButton}
            <button class="btn secondary" data-reject="${listing._id}">Reject</button>
            <button class="btn secondary" data-remove="${listing._id}">Remove</button>
          </td>
        </tr>
      `;
      })
      .join("");

    document.querySelectorAll("[data-block]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const endpoint = btn.textContent.includes("Unblock")
          ? "unblock"
          : "block";
        await api.request(`/api/admin/users/${btn.dataset.block}/${endpoint}`, {
          method: "PATCH",
        });
        loadAdmin();
      });
    });

    document.querySelectorAll("[data-approve]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api.request(
          `/api/admin/listings/${btn.dataset.approve}/approve`,
          { method: "PATCH" },
        );
        loadAdmin();
      });
    });

    document.querySelectorAll("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api.request(`/api/admin/listings/${btn.dataset.reject}/reject`, {
          method: "PATCH",
        });
        loadAdmin();
      });
    });

    document.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api.request(`/api/admin/listings/${btn.dataset.remove}`, {
          method: "DELETE",
        });
        loadAdmin();
      });
    });
  } catch (error) {
    ui.setNotice("adminNotice", error.message);
  } finally {
    ui.showLoader("adminLoader", false);
  }
};

loadAdmin();
