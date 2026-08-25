/**
 * Add priority column to ai_tools table
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addPriorityColumn() {
    console.log('Adding priority column to ai_tools table...\n');

    // Use RPC to run raw SQL
    const { error } = await supabase.rpc('exec_sql', {
        sql_query: `
      ALTER TABLE ai_tools 
      ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 50;
    `
    });

    if (error) {
        // Try alternative approach - update all tools with a priority value
        console.log('Direct SQL failed, trying alternative approach...');
        console.log('Error:', error.message);

        // Just update tools in batches to add priority
        let page = 0;
        const pageSize = 100;
        let updated = 0;

        while (true) {
            const { data: tools, error: fetchError } = await supabase
                .from('ai_tools')
                .select('id')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (fetchError || !tools || tools.length === 0) break;

            page++;
        }

        console.log('Note: You may need to add the priority column manually via Supabase dashboard.');
        console.log('Go to Table Editor > ai_tools > Add column > "priority" (int4, default 50)');
    } else {
        console.log('✅ Priority column added successfully!');
    }
}

addPriorityColumn();
