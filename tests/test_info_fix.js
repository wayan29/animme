const { scrapeDetail } = require('../server/kuramanime');

async function testInfoFix() {
    try {
        console.log('Testing scrapeDetail with info field fix...\n');
        
        const result = await scrapeDetail('4081', 'ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga');
        
        console.log('=== INFO FIELD ===\n');
        console.log(`Total info fields: ${Object.keys(result.info).length}\n`);
        
        Object.keys(result.info).forEach(key => {
            const value = result.info[key];
            console.log(`  ${key}: ${value}`);
        });
        
        // Check if info has data
        const hasData = Object.keys(result.info).length > 0 && 
                       Object.values(result.info).some(v => v && v.trim() !== '');
        
        console.log('\n=== VALIDATION ===');
        console.log(`✓ Has info fields: ${Object.keys(result.info).length > 0}`);
        console.log(`✓ Info has values: ${hasData}`);
        
        if (hasData) {
            console.log('\n✓ SUCCESS: Info field is now populated!');
        } else {
            console.log('\n⚠ WARNING: Info field still empty!');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testInfoFix();
