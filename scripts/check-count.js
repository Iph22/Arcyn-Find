require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ ERROR: Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkCount() {
    const { count, error } = await supabase
        .from('ai_tools')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`\n📊 Total tools in DB: ${count}`);
}

checkCount();
