#!/usr/bin/env node

require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkMidjourney() {
  const { data, error } = await supabase
    .from('ai_tools')
    .select('id, name, image, platform')
    .ilike('name', '%midjourney%')
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Midjourney tools found:');
  data?.forEach(t => {
    console.log(`\n${t.name}:`);
    console.log(`  ID: ${t.id}`);
    console.log(`  Platform: ${t.platform}`);
    console.log(`  Image: ${t.image || 'NO IMAGE'}`);
    if (t.image) {
      console.log(`  Image contains 'r-synth': ${t.image.toLowerCase().includes('r-synth')}`);
    }
  });
}

checkMidjourney()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });

