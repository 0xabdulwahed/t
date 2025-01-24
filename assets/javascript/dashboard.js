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
            checkTemperature();
            break;
          case "Manager":
            loadManagerDashboard(branch);
            startTemperatureMonitoring(branch);
            checkTemperature(branch);
            break;
          default:
            handleUnauthorizedAccess();
        }
      });
  } else {
    redirectToLogin();
  }
});

let lastNotifiedBranches = {};

function startTemperatureMonitoring(branchFilter = null) {
  checkTemperature(branchFilter);

  setInterval(() => {
    checkTemperature(branchFilter);
  }, 30 * 60 * 1000);
}

function checkTemperature(branchFilter = null) {
  if (branchFilter) {
    // For Manager: Check only the specific branch
    db.ref(`Branches/${branchFilter}`)
      .once("value")
      .then((snapshot) => {
        const locationData = snapshot.val();
        if (locationData) {
          Object.keys(locationData).forEach((location) => {
            const branches = locationData[location];
            Object.keys(branches).forEach((branchName) => {
              const branch = branches[branchName];
              if (branch.Temperature >= 10 && shouldNotify(branchName)) {
                sendNotification(
                  "Alert: High Temperature",
                  `The temperature in branch ${branchName} (${location}) is ${branch.Temperature}°C.`
                );
                lastNotifiedBranches[branchName] = Date.now();
              }
            });
          });
        }
      });
  } else {
    // For Admin: Check all branches
    db.ref("Branches")
      .once("value")
      .then((snapshot) => {
        const locations = snapshot.val();
        if (locations) {
          Object.keys(locations).forEach((location) => {
            const branches = locations[location];
            Object.keys(branches).forEach((branchName) => {
              const branch = branches[branchName];
              if (branch.Temperature >= 10 && shouldNotify(branchName)) {
                sendNotification(
                  "Alert: High Temperature",
                  `The temperature in branch ${branchName} (${location}) is ${branch.Temperature}°C.`
                );
                lastNotifiedBranches[branchName] = Date.now();
              }
            });
          });
        }
      });
  }
}

function shouldNotify(branchName) {
  return (
    !lastNotifiedBranches[branchName] ||
    Date.now() - lastNotifiedBranches[branchName] > 30 * 60 * 1000
  );
}

// Dashboard Loading Functions
function loadAdminDashboard() {
  db.ref("Branches").on("value", (snapshot) => {
    const locations = snapshot.val();
    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = locations
      ? renderLocations(locations)
      : "<p>No branches available.</p>";
  });
}

function loadManagerDashboard(branch) {
  db.ref(`Branches/${branch}`).on("value", (snapshot) => {
    const locationData = snapshot.val();
    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = locationData
      ? renderLocation(branch, locationData)
      : "<p>No data available for this branch.</p>";
  });
}

function renderLocations(locations) {
  return Object.entries(locations)
    .map(([location, branches]) => {
      return renderBranches(branches, location); // نرجع الـ boxes مباشرة
    })
    .join("");
}

function renderBranches(branches, location) {
  return Object.entries(branches)
    .map(([branchName, branch]) => renderBranch(branchName, branch, location))
    .join("");
}

function renderBranch(branchName, branch, location) {
  return `
    <div class="box">
      <h3>Room Temperature</h3>
      <span class="temperature">${branch.Temperature}°C</span>
      <div class="details">
        <span><i class="fas fa-map-marker-alt"></i> Location: <strong>${location}</strong></span>
        <span><i class="fas fa-code-branch"></i> Branch: <strong>${branchName}</strong></span>
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

document
  .getElementById("logout-button")
  .addEventListener("click", handleLogout);
document
  .getElementById("logout-button-mobile")
  .addEventListener("click", handleLogout);
