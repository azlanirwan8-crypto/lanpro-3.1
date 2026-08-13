const fs = require('fs');
let code = fs.readFileSync('server/routes/task.routes.ts', 'utf8');
code = code.replace(/const newBlockedVal = isBlocked \? 1 : 0;/g, 'const newBlockedVal = isBlocked ? true : false;');
code = code.replace(/const oldBlockedVal = oldTask\.isBlocked === true \|\| oldTask\.isBlocked === 1 \? 1 : 0;/g, 'const oldBlockedVal = oldTask.isBlocked === true || oldTask.isBlocked === 1 ? true : false;');
code = code.replace(/changedFields\.isBlocked === 1/g, 'changedFields.isBlocked === true');
code = code.replace(/oldTask\.isBlocked === 0/g, 'oldTask.isBlocked === false');
fs.writeFileSync('server/routes/task.routes.ts', code);
