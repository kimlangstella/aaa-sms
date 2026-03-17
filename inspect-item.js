
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, getDoc, doc, query, limit } = require("firebase/firestore");

// Hardcoded for debug based on firebase.ts
const firebaseConfig = {
    apiKey: "...", // I don't have the actual keys but I can try to get them from .env.local via command line
    authDomain: "school-management-a3770.firebaseapp.com",
    projectId: "school-management-a3770",
    storageBucket: "school-management-a3770.appspot.com",
    messagingSenderId: "951000949430",
    appId: "1:951000949430:web:44754589d36371754020a5",
};

// ... try to read .env.local via fs
const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const apiKey = envContent.match(/NEXT_PUBLIC_FIREBASE_API_KEY=(.*)/)[1];
firebaseConfig.apiKey = apiKey.trim();

async function inspect() {
    try {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        
        console.log("Checking item: wVCQLAvaLMKzobKMInWY");
        const itemDoc = await getDoc(doc(db, "inventory", "wVCQLAvaLMKzobKMInWY"));
        if (itemDoc.exists()) {
            console.log("Item Found!", JSON.stringify(itemDoc.data(), null, 2));
        } else {
            console.log("Item NOT found in 'inventory' collection.");
            
            // Try searching other collections or looking for items
            const q = query(collection(db, "inventory"), limit(10));
            const snap = await getDocs(q);
            console.log(`Found ${snap.size} items in inventory collection. Sample IDs:`, snap.docs.map(d => d.id));
        }
    } catch (e) {
        console.error(e);
    }
}

inspect();
