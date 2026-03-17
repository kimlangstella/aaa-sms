
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

async function search() {
    const collections = ["inventory", "program_addons"];
    for (const colName of collections) {
        console.log(`--- Checking ${colName} ---`);
        try {
            const snap = await getDocs(collection(db, colName));
            console.log(`Found ${snap.size} documents in ${colName}`);
            snap.forEach(doc => {
                const d = doc.data();
                if (colName === "program_addons" || JSON.stringify(d).toLowerCase().includes("uniform") || JSON.stringify(d).toLowerCase().includes("adult")) {
                    console.log(`MATCH in ${colName} | ID: ${doc.id} | Data: ${JSON.stringify(d)}`);
                }
            });
        } catch (e) {
            console.log(`Error reading ${colName}: ${e.message}`);
        }
    }
}

search().catch(console.error);
