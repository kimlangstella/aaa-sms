
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, query, where } = require("firebase/firestore");

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
    console.log("--- BRANCHES ---");
    const branchSnap = await getDocs(collection(db, "branches"));
    branchSnap.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id} | Name: ${d.branch_name}`);
    });

    console.log("\n--- PROGRAMS ---");
    const progSnap = await getDocs(collection(db, "programs"));
    progSnap.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id} | Name: ${d.name} | BranchIds: ${JSON.stringify(d.branchId || d.branchIds)}`);
    });
}

dump().catch(console.error);
