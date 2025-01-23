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

        switch (role) {
          case "Admin":
            loadAdminDashboard();
            startTemperatureMonitoring();
            break;
          case "Manager":
            loadManagerDashboard(branch);
            startTemperatureMonitoring(branch);
            break;
          default:
            handleUnauthorizedAccess();
        }
      });
  } else {
    redirectToLogin();
  }
});

// Temperature Monitoring
let lastNotifiedBranches = {};

function startTemperatureMonitoring(branchFilter = null) {
  setInterval(() => {
    db.ref("Branches")
      .once("value")
      .then((snapshot) => {
        const branches = snapshot.val();
        const branchNames = branchFilter
          ? [branchFilter]
          : Object.keys(branches);

        branchNames.forEach((branchName) => {
          const branch = branches[branchName];

          if (branch.Temperature >= 5 && shouldNotify(branchName)) {
            sendNotification(
              "Alert: High Temperature",
              `The temperature in branch ${branchName} is ${branch.Temperature}°C.`
            );
            lastNotifiedBranches[branchName] = Date.now();
          }
        });
      });
  }, 1 * 60 * 1000);
}

function shouldNotify(branchName) {
  return (
    !lastNotifiedBranches[branchName] ||
    Date.now() - lastNotifiedBranches[branchName] > 1 * 60 * 1000
  );
}

// Dashboard Loading Functions
function loadAdminDashboard() {
  db.ref("Branches").on("value", (snapshot) => {
    const branches = snapshot.val();
    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = branches
      ? renderBranches(branches)
      : "<p>No branches available.</p>";
  });
}

function loadManagerDashboard(branch) {
  db.ref(`Branches/${branch}`).on("value", (snapshot) => {
    const branchData = snapshot.val();
    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = branchData
      ? renderBranch(branch, branchData)
      : "<p>No data available for this branch.</p>";
  });
}

function renderBranches(branches) {
  return Object.entries(branches)
    .map(([branchName, branch]) => renderBranch(branchName, branch))
    .join("");
}

function renderBranch(branchName, branch) {
  return `
    <div class="box">
      <h3>Room Temperature</h3>
      <span class="temperature">${branch.Temperature}°C</span>
      <div class="details">
        <span><i class="fas fa-code-branch"></i> Branch: <strong>${branchName}</strong></span>
        <span><i class="fas fa-map-marker-alt"></i> Location: <strong>${branch.Location}</strong></span>
        <span><i class="fas fa-door-open"></i> Door: <strong>Rush Time</strong></span>
      </div>
    </div>
  `;
}

// Notification Function
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

// Utility Functions
function handleUnauthorizedAccess() {
  alert("Unauthorized access!");
  auth.signOut();
  localStorage.removeItem("isLoggedIn");
  redirectToLogin();
}

function redirectToLogin() {
  window.location.href = "login.html";
}

// Logout Functionality
function handleLogout() {
  auth.signOut().then(() => {
    localStorage.removeItem("isLoggedIn");
    redirectToLogin();
  });
}

document.getElementById("logout-button").addEventListener("click", handleLogout);
document.getElementById("logout-button-mobile").addEventListener("click", handleLogout);
