import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDrE6ruqeozwTn_Mp9dWD9FVlcey0djY-c",
    authDomain: "railmaint-a716b.firebaseapp.com",
    projectId: "railmaint-a716b",
    storageBucket: "railmaint-a716b.firebasestorage.app",
    messagingSenderId: "266902605572",
    appId: "1:266902605572:web:9cd96ddf776d9ae2040a51",
    measurementId: "G-79LR34ELLE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const auth = getAuth(app);
export default app;