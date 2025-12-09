// Firebase configuration
const config = {
  apiKey: "AIzaSyDuN66nPMyza8PA25c_pBLvRyBQhRyjQ3I",
  authDomain: "rezam-77.firebaseapp.com",
  databaseURL: "https://rezam-77-default-rtdb.firebaseio.com",
  projectId: "rezam-77",
  storageBucket: "rezam-77.appspot.com",
  messagingSenderId: "295787269902",
  appId: "1:295787269902:web:e734991fb7811e26f5915f",
  measurementId: "G-8P6H9SEC5E"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(config);
} else {
    firebase.app(); // if already initialized, use that one
}

// Export services
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();
const analytics = firebase.analytics();