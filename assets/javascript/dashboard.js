// Constants
const MONITORING_INTERVAL = 30 * 60 * 1000; // 30 minutes
const LOCAL_STORAGE_KEY = "isLoggedIn";
const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  AREA_MANAGER: "area-manager",
};

// Temperature Monitor Class
class TemperatureMonitor {
  constructor() {
    this.lastNotifiedBranches = {};
  }

  startMonitoring(branchFilter = null) {
    this.checkTemperature(branchFilter);
    setInterval(() => this.checkTemperature(branchFilter), MONITORING_INTERVAL);
  }

  checkTemperature(branchFilter = null) {
    const branchRef = branchFilter
      ? db.ref(`branches/${branchFilter}`)
      : db.ref("branches");

    branchRef.on("value", (snapshot) => {
      const branchesData = branchFilter
        ? { [branchFilter]: snapshot.val() }
        : snapshot.val();

      if (!branchesData) return;

      Object.keys(branchesData).forEach((branchName) => {
        const branch = branchesData[branchName];
        const refrigerators = branch?.devices?.refrigerators || {};

        Object.keys(refrigerators).forEach((roomName) => {
          const room = refrigerators[roomName];

          // Check Temperature
          if (
            room.temperature >= 5 &&
            this.shouldNotify(branchName, roomName)
          ) {
            NotificationService.send(
              "Warning: High Temperature",
              `Temperature at ${branch.name || branchName} (${
                branch.location || "N/A"
              }) is ${room.temperature}°C in ${roomName}`
            );
            this.lastNotifiedBranches[branchName] = {
              ...this.lastNotifiedBranches[branchName],
              [roomName]: Date.now(),
            };
          }

          // Check Door Status
          if (
            room["door-room"] === "open" &&
            this.shouldNotify(branchName, `${roomName}-door`)
          ) {
            NotificationService.send(
              "Warning: Door Open",
              `The door of ${roomName} at ${branch.name || branchName} (${
                branch.location || "N/A"
              }) is open`
            );
            this.lastNotifiedBranches[branchName] = {
              ...this.lastNotifiedBranches[branchName],
              [`${roomName}-door`]: Date.now(),
            };
          }
        });
      });
    });
  }

  shouldNotify(branchName, roomType) {
    return (
      !this.lastNotifiedBranches[branchName]?.[roomType] ||
      Date.now() - this.lastNotifiedBranches[branchName][roomType] >
        MONITORING_INTERVAL
    );
  }
}

// Dashboard Manager Class
class DashboardManager {
  static loadAdminDashboard() {
    UIManager.showLoading();
    db.ref("branches").on("value", (snapshot) => {
      const branches = snapshot.val();
      const dashboard = document.getElementById("dashboard");
      dashboard.innerHTML = branches
        ? this.renderBranches(branches)
        : "<p>No branches available</p>";
      UIManager.hideLoading();
    });
  }

  static loadManagerDashboard(branchName) {
    UIManager.showLoading();
    db.ref(`branches/${branchName}`).on("value", (snapshot) => {
      const branchData = snapshot.val();
      const dashboard = document.getElementById("dashboard");
      dashboard.innerHTML = branchData
        ? this.renderBranch(branchName, branchData)
        : "<p>No data available for this branch</p>";
      UIManager.hideLoading();
    });
  }

  static loadRegionalDashboard(branchArray) {
    UIManager.showLoading();
    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = "";

    Promise.all(
      branchArray.map(
        (branchName) =>
          new Promise((resolve) =>
            db.ref(`branches/${branchName}`).on("value", (snapshot) => {
              resolve({ branchName, data: snapshot.val() });
            })
          )
      )
    ).then((results) => {
      results.forEach(({ branchName, data }) => {
        if (data) dashboard.innerHTML += this.renderBranch(branchName, data);
      });
      UIManager.hideLoading();
    });
  }

  static renderBranches(branches) {
    return Object.entries(branches)
      .map(([name, data]) => this.renderBranch(name, data))
      .join("");
  }

  static renderBranch(branchName, branchData) {
    const refrigerators = branchData?.devices?.refrigerators || {};

    return `
    <div class="box" data-branch="${branchName}">
      <h2>${branchData.name || branchName}</h2>
      <span class="location"><i class="i fas fa-map-marker-alt"></i> ${
        branchData.location || "N/A"
      }</span>

      ${Object.entries(refrigerators)
        .map(
          ([roomName, room]) => `
          <div class="room-section">
            <h3><i class="fas fa-snowflake"></i> ${roomName}</h3>
            <div class="sensor-data">
              <span class="temperature">${room.temperature || "N/A"}°C</span>
              <span class="door-status">Door: ${
                room["door-room"] || "N/A"
              }</span>
            </div>
          </div>
        `
        )
        .join("")}
    </div>
  `;
  }
}

// Notification Service
class NotificationService {
  static send(title, body) {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") new Notification(title, { body });
      });
    }
  }
}

// UI Manager
class UIManager {
  static showLoading() {
    const loader = document.querySelector(".sk-chase");
    if (loader) loader.style.display = "block";
  }

  static hideLoading() {
    const loader = document.querySelector(".sk-chase");
    if (loader) loader.style.display = "none";
  }

  static setupEventListeners() {
    document.querySelectorAll(".logout-button").forEach((button) => {
      button.addEventListener("click", AuthManager.handleLogout);
    });
  }
}

// Auth Manager
class AuthManager {
  static init() {
    auth.onAuthStateChanged((user) => this.handleAuthState(user));
  }

  static handleAuthState(user) {
    UIManager.showLoading();

    if (user || localStorage.getItem(LOCAL_STORAGE_KEY) === "true") {
      this.fetchUserData(user);
    } else {
      this.redirectToLogin();
    }
  }

  static async fetchUserData(user) {
    try {
      const userEmailKey = user ? user.email.replace(".", ",") : "guest";
      const snapshot = await db.ref(`users/${userEmailKey}`).once("value");
      const userData = snapshot.val();

      if (!userData) throw new Error("User data not found");

      this.handleUserRole(userData.role, userData.branch, userData.branches);
    } catch (error) {
      console.error("Error fetching user data:", error);
      this.handleUnauthorizedAccess();
    }
  }

  static handleUserRole(role, branch, branches) {
    const temperatureMonitor = new TemperatureMonitor();

    switch (role) {
      case ROLES.ADMIN:
        DashboardManager.loadAdminDashboard();
        temperatureMonitor.startMonitoring();
        break;
      case ROLES.MANAGER:
        DashboardManager.loadManagerDashboard(branch);
        temperatureMonitor.startMonitoring(branch);
        break;
      case ROLES.AREA_MANAGER:
        if (branches) {
          const branchArray = Object.keys(branches);
          DashboardManager.loadRegionalDashboard(branchArray);
          temperatureMonitor.startMonitoring(branchArray);
        }
        break;
      default:
        this.handleUnauthorizedAccess();
    }
  }

  static handleUnauthorizedAccess() {
    alert("Unauthorized access!");
    this.signOutUser();
  }

  static handleLogout() {
    auth.signOut().then(() => this.signOutUser());
  }

  static signOutUser() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    this.redirectToLogin();
  }

  static redirectToLogin() {
    window.location.href = "login.html";
  }
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  AuthManager.init();
  UIManager.setupEventListeners();
});
