const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

// Attempt to find service account
const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('Service account not found at:', serviceAccountPath);
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkInventory() {
  const snapshot = await db.collection('inventory').get();
  console.log('--- Inventory Items ---');
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`Name: ${data.name}`);
    console.log(`Total Stock: ${data.attributes?.totalStock}`);
    console.log(`Stock Out: ${data.attributes?.stockOut}`);
    if (data.attributes?.variants) {
      console.log('Variants:');
      data.attributes.variants.forEach(v => {
        console.log(`  - ${v.name}: Stock=${v.stock}, ID=${v.id}`);
      });
    }
    console.log('-----------------------');
  });
}

checkInventory();
