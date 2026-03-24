const statsGrid = document.getElementById("statsGrid");
const userTable = document.getElementById("userTable");
const listingTable = document.getElementById("listingTable");
const reportTable = document.getElementById("reportTable");
const reportStatusFilter = document.getElementById("reportStatusFilter");
const reportSearchInput = document.getElementById("reportSearchInput");
const reportSortFilter = document.getElementById("reportSortFilter");
const reportEscalatedOnly = document.getElementById("reportEscalatedOnly");
let cachedReports = [];

const bindOnce = (element, eventName, handler) => {
  if (!element) {
    return;
  }
  const key = `bound_${eventName}`;
  if (element.dataset[key]) {
    return;
  }
  element.addEventListener(eventName, handler);
  element.dataset[key] = "1";
};

const getSelectedReportStatus = () =>
  String(reportStatusFilter?.value || "open")
    .trim()
    .toLowerCase();

const getReportSearchTerm = () =>
  String(reportSearchInput?.value || "")
    .trim()
    .toLowerCase();

const getSelectedReportSort = () =>
  String(reportSortFilter?.value || "newest")
    .trim()
    .toLowerCase();

const isEscalatedOnlyEnabled = () => Boolean(reportEscalatedOnly?.checked);

const reportTargetText = (report) => {
  if (report.targetType === "listing") {
    const title = report.targetListing?.title || "Deleted listing";
    return `Listing: ${title}`;
  }
  const name = report.targetUser?.name || "Deleted user";
  return `User: ${name}`;
};

const getEnforcementOptions = (report) =>
  report.targetType === "user"
    ? ["none", "block-user"]
    : ["none", "block-user", "remove-listing", "remove-listing-and-block-user"];

const formatEnforcementLabel = (value) =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getReportRowNote = (reportId) => {
  const input = document.querySelector(`[data-report-note="${reportId}"]`);
  return String(input?.value || "").trim();
};

const getReportRowEnforcement = (reportId) => {
  const select = document.querySelector(
    `[data-report-enforcement="${reportId}"]`,
  );
  return String(select?.value || "none")
    .trim()
    .toLowerCase();
};

const setReportRowBusy = (reportId, isBusy, message = "") => {
  const controls = document.querySelectorAll(
    `[data-report-action-for="${reportId}"], [data-report-enforcement="${reportId}"], [data-report-note="${reportId}"]`,
  );
  controls.forEach((el) => {
    el.disabled = isBusy;
  });

  const statusEl = document.querySelector(`[data-report-status="${reportId}"]`);
  if (statusEl) {
    statusEl.textContent = message;
  }
};

const reportMatchesSearch = (report, searchTerm) => {
  if (!searchTerm) {
    return true;
  }

  const haystack = [
    report.reporter?.name,
    report.reporter?.email,
    report.targetUser?.name,
    report.targetUser?.email,
    report.targetListing?.title,
    report.reason,
    report.details,
    report.status,
    report.enforcementSummary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchTerm);
};

const reportRiskScore = (report) => {
  const reason = String(report.reason || "").toLowerCase();
  const riskByReason = {
    scam: 5,
    prohibited: 4,
    harassment: 4,
    fake: 3,
    spam: 2,
    other: 1,
  };
  return riskByReason[reason] || 0;
};

const reportSeverityMeta = (report) => {
  const score = reportRiskScore(report);
  if (score >= 5) {
    return { label: "Critical", className: "critical" };
  }
  if (score >= 4) {
    return { label: "High", className: "high" };
  }
  if (score >= 2) {
    return { label: "Medium", className: "medium" };
  }
  return { label: "Low", className: "low" };
};

const sortReports = (reports) => {
  const selectedSort = getSelectedReportSort();
  const sorted = [...reports];

  if (selectedSort === "oldest") {
    sorted.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return sorted;
  }

  if (selectedSort === "high-risk") {
    sorted.sort((a, b) => {
      const riskDiff = reportRiskScore(b) - reportRiskScore(a);
      if (riskDiff !== 0) {
        return riskDiff;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }

  sorted.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return sorted;
};

const renderUsersTable = (users) => {
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
};

const renderListingsTable = (listings) => {
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
};

const bindUserActions = () => {
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
};

const bindListingActions = () => {
  document.querySelectorAll("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api.request(`/api/admin/listings/${btn.dataset.approve}/approve`, {
        method: "PATCH",
      });
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
};

const bindReportFilters = () => {
  bindOnce(reportStatusFilter, "change", () => {
    loadAdmin();
  });
  bindOnce(reportSearchInput, "input", () => {
    renderReportTable(cachedReports);
  });
  bindOnce(reportSortFilter, "change", () => {
    renderReportTable(cachedReports);
  });
  bindOnce(reportEscalatedOnly, "change", () => {
    renderReportTable(cachedReports);
  });
};

const renderReportTable = (reports) => {
  const searchTerm = getReportSearchTerm();
  const escalatedOnly = isEscalatedOnlyEnabled();
  const filteredReports = sortReports(
    reports.filter(
      (report) =>
        reportMatchesSearch(report, searchTerm) &&
        (!escalatedOnly || reportRiskScore(report) >= 4),
    ),
  );

  reportTable.innerHTML = filteredReports.length
    ? filteredReports
        .map((report) => {
          const reporter = report.reporter?.name || "Unknown";
          const severity = reportSeverityMeta(report);
          const details = report.details
            ? `<div class="meta" style="margin-top:4px">${ui.escapeHtml(report.details)}</div>`
            : "";
          const enforcementOptions = getEnforcementOptions(report)
            .map(
              (option) =>
                `<option value="${option}">${ui.escapeHtml(
                  formatEnforcementLabel(option),
                )}</option>`,
            )
            .join("");
          const reviewedByName = report.reviewedBy?.name || "Admin";
          const reviewedAt = report.reviewedAt
            ? ui.date(report.reviewedAt)
            : "";
          const moderationSummary = report.enforcementSummary
            ? ui.escapeHtml(report.enforcementSummary)
            : "No enforcement applied";

          const openActions = `
            <div style="display:flex;flex-direction:column;gap:8px;min-width:220px;">
              <select class="input report-action-select" data-report-enforcement="${report._id}" style="height:36px;">
                ${enforcementOptions}
              </select>
              <input class="input" data-report-note="${report._id}" placeholder="Resolution or dismissal note" style="height:36px;" />
              <div style="display:flex;gap:8px;">
                <button class="btn secondary" data-report-resolve="${report._id}" data-report-action-for="${report._id}" style="height:36px;">Resolve</button>
                <button class="btn secondary" data-report-dismiss="${report._id}" data-report-action-for="${report._id}" style="height:36px;">Dismiss</button>
              </div>
              <div class="meta" data-report-status="${report._id}" style="min-height:18px;"></div>
            </div>
          `;

          const closedSummary = `
            <div style="min-width:220px;display:flex;flex-direction:column;gap:4px;">
              <div class="meta"><strong>Enforcement:</strong> ${moderationSummary}</div>
              <div class="meta"><strong>Reviewed by:</strong> ${ui.escapeHtml(reviewedByName)}</div>
              ${reviewedAt ? `<div class="meta"><strong>Reviewed on:</strong> ${ui.escapeHtml(reviewedAt)}</div>` : ""}
            </div>
          `;

          return `
            <tr>
              <td>${ui.escapeHtml(reporter)}</td>
              <td>${ui.escapeHtml(reportTargetText(report))}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span class="report-severity-badge ${severity.className}">${ui.escapeHtml(severity.label)}</span>
                  <span>${ui.escapeHtml(report.reason)}</span>
                </div>
                ${details}
              </td>
              <td>${ui.escapeHtml(report.status)}</td>
              <td>${ui.escapeHtml(ui.date(report.createdAt))}</td>
              <td>
                ${report.status === "open" ? openActions : closedSummary}
              </td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="6">No reports match current filters.</td></tr>`;

  const reportById = new Map(
    filteredReports.map((report) => [String(report._id), report]),
  );

  const handleReportAction = (action) => async (btn) => {
    const reportId = String(
      action === "resolve"
        ? btn.dataset.reportResolve
        : btn.dataset.reportDismiss,
    );
    try {
      const report = reportById.get(reportId);
      if (!report) {
        throw new Error("Report not found in current table state.");
      }

      setReportRowBusy(
        reportId,
        true,
        action === "resolve" ? "Resolving report..." : "Dismissing report...",
      );

      const resolutionNote = getReportRowNote(reportId);
      const payload = { action, resolutionNote };

      if (action === "resolve") {
        const enforcementAction = getReportRowEnforcement(reportId);
        const allowed = getEnforcementOptions(report);
        if (!allowed.includes(enforcementAction)) {
          throw new Error("Invalid enforcement action.");
        }
        payload.enforcementAction = enforcementAction;
      }

      await api.request(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setReportRowBusy(
        reportId,
        true,
        action === "resolve"
          ? "Resolved. Refreshing..."
          : "Dismissed. Refreshing...",
      );
      loadAdmin();
    } catch (error) {
      setReportRowBusy(reportId, false, "");
      ui.setNotice("adminNotice", error.message);
    }
  };

  document.querySelectorAll("[data-report-resolve]").forEach((btn) => {
    btn.addEventListener("click", () => handleReportAction("resolve")(btn));
  });

  document.querySelectorAll("[data-report-dismiss]").forEach((btn) => {
    btn.addEventListener("click", () => handleReportAction("dismiss")(btn));
  });
};

const loadAdmin = async () => {
  if (!statsGrid || !userTable || !listingTable || !reportTable) {
    return;
  }

  ui.showLoader("adminLoader", true);
  try {
    const currentUser = await auth.ensureUser();
    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    const selectedStatus = getSelectedReportStatus();
    const reportQuery =
      selectedStatus === "all"
        ? "/api/admin/reports"
        : `/api/admin/reports?status=${encodeURIComponent(selectedStatus)}`;

    const [stats, users, listings, reports] = await Promise.all([
      api.request("/api/admin/stats"),
      api.request("/api/admin/users"),
      api.request("/api/admin/listings"),
      api.request(reportQuery),
    ]);

    statsGrid.innerHTML = `
      <div class="card"><h4>Users</h4><div class="price">${stats.users}</div></div>
      <div class="card"><h4>Listings</h4><div class="price">${stats.listings}</div></div>
      <div class="card"><h4>Pending</h4><div class="price">${stats.pendingListings}</div></div>
      <div class="card"><h4>Blocked</h4><div class="price">${stats.blockedUsers}</div></div>
      <div class="card"><h4>Open Reports</h4><div class="price">${stats.openReports || 0}</div></div>
    `;

    renderUsersTable(users);
    renderListingsTable(listings);

    cachedReports = reports;
    renderReportTable(cachedReports);

    bindUserActions();
    bindListingActions();
    bindReportFilters();
  } catch (error) {
    ui.setNotice("adminNotice", error.message);
  } finally {
    ui.showLoader("adminLoader", false);
  }
};

loadAdmin();
