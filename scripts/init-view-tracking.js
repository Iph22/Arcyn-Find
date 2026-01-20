/**
 * Initialize view tracking columns on ai_tools table
 * Run this once to set up the columns needed for view tracking
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function initViewTracking() {
    console.log('🔧 Initializing view tracking columns...\n');

    // Check if view_count column exists by trying to query it
    const { data: sample, error } = await supabase
        .from('ai_tools')
        .select('id, view_count')
        .limit(1);

    if (error && error.message.includes('view_count')) {
        console.log('❌ view_count column does not exist yet.');
        console.log('\n📋 Please add these columns in Supabase Dashboard:');
        console.log('   Table: ai_tools');
        console.log('   Columns to add:');
        console.log('   - view_count (int4, default 0)');
        console.log('   - view_count_24h (int4, default 0)');
        console.log('   - view_count_7d (int4, default 0)');
        console.log('   - last_view_at (timestamptz, nullable)');
        console.log('   - trending_score (float4, default 0)');
        console.log('\n   Also create a new table: tool_views');
        console.log('   - id (uuid, primary key, gen_random_uuid())');
        console.log('   - tool_id (text, foreign key to ai_tools.id)');
        console.log('   - viewed_at (timestamptz, default now())');
        console.log('   - ip_hash (text, nullable)');
        console.log('   - session_id (text, nullable)');
        console.log('   - source (text, default "web")');
        return;
    }

    console.log('✅ view_count column exists!');

    // Initialize all tools with view_count = 0 if null
    const { error: updateError } = await supabase
        .from('ai_tools')
        .update({ view_count: 0 })
        .is('view_count', null);

    if (updateError) {
        console.log('Note: Could not initialize null view counts:', updateError.message);
    } else {
        console.log('✅ Initialized null view counts to 0');
    }

    // Count how many tools have views
    const { count } = await supabase
        .from('ai_tools')
        .select('*', { count: 'exact', head: true })
        .gt('view_count', 0);

    console.log(`\n📊 Tools with views: ${count || 0}`);
    console.log('\n✅ View tracking setup complete!');
}

initViewTracking().catch(console.error);
