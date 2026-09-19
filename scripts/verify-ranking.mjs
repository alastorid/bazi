import {spawnSync} from 'node:child_process';
const result=spawnSync('python3',['scripts/verify-native.py','ranking'],{stdio:'inherit'});
process.exit(result.status??1);
