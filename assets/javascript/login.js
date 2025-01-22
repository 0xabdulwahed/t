// Login Form Submission
document
  .getElementById("login-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    // Get form values
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const errorMessage = document.getElementById("error-message");

    // Display error message
    const showError = (message) => {
      errorMessage.style.display = "block";
      errorMessage.textContent = message;
    };

    // Clear previous error message
    errorMessage.style.display = "none";

    try {
      // Authenticate user
      await auth.signInWithEmailAndPassword(email, password);

      // Save login state and redirect
      localStorage.setItem("isLoggedIn", "true");
      window.location.href = "index.html";
    } catch (error) {
      // Handle authentication error
      showError("Oops, wrong email or password. Please try again.");
    }
  });
