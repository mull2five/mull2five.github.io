import fs from 'fs';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ 
    allErrors: true,
    strict: true,
    allowUnionTypes: true
});
addFormats(ajv);

function validate(schemaPath, dataPath) {
    try {
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        const fileContent = fs.readFileSync(dataPath, 'utf8');
        const data = yaml.load(fileContent);
        
        const validateFn = ajv.compile(schema);
        const valid = validateFn(data);
        
        if (!valid) {
            console.error(`❌ Validation failed for ${dataPath}:`);
            validateFn.errors.forEach(err => {
                console.error(`  - ${err.instancePath} ${err.message} (${JSON.stringify(err.params)})`);
            });
            return false;
        }
        console.log(`✅ ${dataPath} is valid.`);
        return true;
    } catch (e) {
        console.error(`❌ Error validating ${dataPath}:`, e.message);
        return false;
    }
}

const validations = [
    { schema: 'schemas/players.schema.json', data: '_data/players.yml' },
    { schema: 'schemas/stats_changes.schema.json', data: '_data/stats_changes.yml' }
];

let allValid = true;
for (const v of validations) {
    if (!validate(v.schema, v.data)) {
        allValid = false;
    }
}

if (!allValid) {
    process.exit(1);
}
