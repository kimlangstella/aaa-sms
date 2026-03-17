
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

async function dump() {
    console.log("--- INVENTORY ---");
    const invSnap = await getDocs(collection(db, "inventory"));
    invSnap.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id} | Name: ${d.name} | BranchId: ${d.branchId} | Category: ${d.category} | SKU: ${d.sku}`);
    });

    console.log("\n--- PROGRAM ADDONS ---");
    const addonSnap = await getDocs(collection(db, "program_addons"));
    addonSnap.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id} | ItemId: ${d.itemId} | ProgramId: ${d.programId} | Label: ${d.label}`);
    });
}

dump().catch(console.error);
