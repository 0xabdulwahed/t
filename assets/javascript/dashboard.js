// Handle Authentication State
auth.onAuthStateChanged((user) => {
  if (user || localStorage.getItem("isLoggedIn") === "true") {
    const userEmailKey = user ? user.email.replace(".", ",") : "guest";
    db.ref(`Users/${userEmailKey}`)
      .once("value")
      .then((snapshot) => {
        const userData = snapshot.val();
        const role = userData?.Role;
        const branch = userData?.Branch;
        const branches = userData?.Branches;

        switch (role) {
          case "Admin":
            loadAdminDashboard();
            startTemperatureMonitoring();
            break;
          case "Manager":
            loadManagerDashboard(branch);
            startTemperatureMonitoring(branch);
            break;
          case "RegionalManager":
            if (branches) {
              const branchArray = Object.keys(branches);
              loadRegionalManagerDashboard(branchArray);
              startTemperatureMonitoringForBranches(branchArray);
            }
            break;
          default:
            handleUnauthorizedAccess();
        }
      })
      .catch((error) => {
        console.error("Error fetching user data:", error);
        handleUnauthorizedAccess();
      });
  } else {
    redirectToLogin();
  }
});

// Track last notified branches to avoid spamming notifications
let lastNotifiedBranches = {};

// Start monitoring multiple branches for Regional Manager
function startTemperatureMonitoringForBranches(branchArray) {
  branchArray.forEach((branch) => checkTemperature(branch));
  setInterval(() => {
    branchArray.forEach((branch) => checkTemperature(branch));
  }, 30 * 60 * 1000); // Check every 30 minutes
}

// Start monitoring for a single branch or all branches
function startTemperatureMonitoring(branchFilter = null) {
  checkTemperature(branchFilter);
  setInterval(() => {
    checkTemperature(branchFilter);
  }, 30 * 60 * 1000); // Check every 30 minutes
}

// Check temperature for a specific branch or all branches
function checkTemperature(branchFilter = null) {
  const branchRef = branchFilter ? db.ref(`Branches/${branchFilter}`) : db.ref("Branches");

  branchRef.on("value", (snapshot) => {
    const branchesData = branchFilter ? { [branchFilter]: snapshot.val() } : snapshot.val();

    if (!branchesData) return;

    Object.keys(branchesData).forEach((branchName) => {
      const branch = branchesData[branchName];
      if (branch.Temperature >= 10 && shouldNotify(branchName)) {
        sendNotification(
          "Alert: High Temperature",
          `The temperature in branch ${branchName} is ${branch.Temperature}°C.`
        );
        lastNotifiedBranches[branchName] = Date.now();
      }
    });
  });
}

// Determine if a notification should be sent for a branch
function shouldNotify(branchName) {
  return (
    !lastNotifiedBranches[branchName] ||
    Date.now() - lastNotifiedBranches[branchName] > 30 * 60 * 1000 // Notify every 30 minutes
  );
}

// Load Admin Dashboard
function loadAdminDashboard() {
  db.ref("Branches").on("value", (snapshot) => {
    const branches = snapshot.val();
    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = branches
      ? renderBranches(branches)
      : "<p>No branches available.</p>";
  });
}

// Load Manager Dashboard
function loadManagerDashboard(branchName) {
  db.ref(`Branches/${branchName}`).on("value", (snapshot) => {
    const branchData = snapshot.val();
    const dashboard = document.getElementById("dashboard");

    if (branchData) {
      dashboard.innerHTML = renderBranch(branchName, branchData);
    } else {
      dashboard.innerHTML = "<p>No data available for this branch.</p>";
    }
  });
}

// Load Regional Manager Dashboard
function loadRegionalManagerDashboard(branchArray) {
  const dashboard = document.getElementById("dashboard");
  dashboard.innerHTML = ""; // Clear previous content

  branchArray.forEach((branchName) => {
    db.ref(`Branches/${branchName}`).on("value", (snapshot) => {
      const branchData = snapshot.val();
      if (branchData) {
        dashboard.innerHTML += renderBranch(branchName, branchData);
      }
    });
  });
}

// Render all branches
function renderBranches(branches) {
  return Object.entries(branches)
    .map(([branchName, branch]) => renderBranch(branchName, branch))
    .join("");
}

// Render a single branch
function renderBranch(branchName, branch) {
  const doorStatus = branch.Door || "Unknown"; // Default to "Unknown" if Door status is not set
  return `
    <div class="box" data-branch="${branchName}">
      <h3>Room Temperature</h3>
      <span class="temperature">${branch.Temperature}°C</span>
      <div class="details">
        <span><i class="fas fa-code-branch"></i> Branch: <strong>${branchName}</strong></span>
        <span><i class="fas fa-door-open"></i> Door: <strong>${doorStatus}</strong></span>
      </div>
    </div>
  `;
}

// Send a browser notification
function sendNotification(title, body) {
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, { body });
      }
    });
  }
}

// Handle unauthorized access
function handleUnauthorizedAccess() {
  alert("Unauthorized access!");
  auth.signOut();
  localStorage.removeItem("isLoggedIn");
  redirectToLogin();
}

// Redirect to login page
function redirectToLogin() {
  window.location.href = "login.html";
}

// Handle logout functionality
function handleLogout() {
  auth.signOut().then(() => {
    localStorage.removeItem("isLoggedIn");
    redirectToLogin();
  });
}

// Attach logout event listeners
document.getElementById("logout-button").addEventListener("click", handleLogout);
document.getElementById("logout-button-mobile").addEventListener("click", handleLogout);
