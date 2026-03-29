const fs = require('fs');
const file = 'd:/Next js project/school-management-system/src/app/admin/setup/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/filteredPrograms\.forEach\(p => \{[\s\S]*?\}\);/, `filteredPrograms.forEach(p => {
                           const key = \`\${p.name}-\${p.price}\`;
                           if (!grouped[key]) grouped[key] = [];
                           grouped[key].push(p);
                       });`);

fs.writeFileSync(file, content);
console.log("Fixed grouping logic.");
