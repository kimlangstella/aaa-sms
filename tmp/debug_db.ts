
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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
        console.log(`ID: ${doc.id}, Name: ${doc.data().name}, BranchId: ${doc.data().branchId}`);
    });

    console.log("--- PROGRAM ADDONS ---");
    const addonSnap = await getDocs(collection(db, "program_addons"));
    addonSnap.forEach(doc => {
        console.log(`ID: ${doc.id}, ItemId: ${doc.data().itemId}, ProgramId: ${doc.data().programId}`);
    });
}

dump().catch(console.error);
