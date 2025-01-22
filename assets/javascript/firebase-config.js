const firebaseConfig = {
  apiKey: "AIzaSyBGlpKl8arTpvLgVm2xTQigNMJAPVPWTec",
  authDomain: "craft-technology-abdulwahed.firebaseapp.com",
  databaseURL:
    "https://craft-technology-abdulwahed-default-rtdb.firebaseio.com",
  projectId: "craft-technology-abdulwahed",
  storageBucket: "craft-technology-abdulwahed.appspot.com",
  messagingSenderId: "428402021082",
  appId: "1:428402021082:web:2d5dd0e767a55cf3098be3",
  measurementId: "G-F6L3YTS44P",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
