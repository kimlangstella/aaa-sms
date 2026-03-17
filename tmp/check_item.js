
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");
require('dotenv').config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkItem() {
    const id = "wVCQLAvaLMKzobKMInWY";
    console.log(`Checking item: ${id}`);
    const docRef = doc(db, "inventory", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        console.log("Item exists:", docSnap.data());
    } else {
        console.log("Item does NOT exist in 'inventory' collection.");
        
        // Try 'products' collection just in case
        const prodRef = doc(db, "products", id);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
            console.log("Item exists in 'products' collection:", prodSnap.data());
        } else {
            console.log("Item does NOT exist in 'products' collection either.");
        }
    }
}

checkItem().catch(console.error);
