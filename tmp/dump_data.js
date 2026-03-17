
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
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

async function dump() {
    console.log("--- INVENTORY ---");
    const invSnap = await getDocs(collection(db, "inventory"));
    invSnap.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id}, Name: ${d.name}, BranchId: ${d.branchId}, Category: ${d.category}`);
    });

    console.log("\n--- PROGRAM ADDONS ---");
    const addonSnap = await getDocs(collection(db, "program_addons"));
    addonSnap.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id}, ItemId: ${d.itemId}, ProgramId: ${d.programId}, Label: ${d.label}`);
    });
}

dump().catch(console.error);
