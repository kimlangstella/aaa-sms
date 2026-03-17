
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyAmHsM0LVc5RUDae446x7zN-19ZK4dllq8",
    authDomain: "aaa-sms-ba597.firebaseapp.com",
    projectId: "aaa-sms-ba597",
    storageBucket: "aaa-sms-ba597.firebasestorage.app",
    messagingSenderId: "729324958018",
    appId: "1:729324958018:web:08807e13c908ee332d18db"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Note: Firestore Web SDK doesn't have listCollections. 
// I have to guess or check common names.
async function checkMore() {
    const guesses = ["inventory", "products", "items", "product_groups", "program_addons", "enrollments", "students", "branches", "programs", "terms", "variants", "stock"];
    for (const name of guesses) {
        try {
            const snap = await getDocs(collection(db, name));
            console.log(`Collection '${name}': ${snap.size} docs`);
        } catch (e) {
            console.log(`Collection '${name}': Error ${e.message}`);
        }
    }
}

checkMore().catch(console.error);
