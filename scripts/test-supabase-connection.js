#!/usr/bin/env node

/**
 * Test Supabase connection and diagnose issues
 */

require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Testing Supabase Connection...\n');

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set!');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set!');
  process.exit(1);
}

console.log('✅ Environment variables found');
console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`);
console.log(`   Key: ${serviceRoleKey.substring(0, 20)}...\n`);

// Custom fetch with better timeout
async function customFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

console.log('🔌 Creating Supabase client...');
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: customFetch,
  },
});

console.log('📡 Testing database connection...');
(async () => {
  try {
    const { data, error } = await supabase
      .from('ai_tools')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Database query failed!');
      console.error(`   Error: ${error.message}`);
      console.error(`   Code: ${error.code || 'N/A'}`);
      console.error(`   Details: ${error.details || 'N/A'}`);
      console.error(`   Hint: ${error.hint || 'N/A'}`);
      process.exit(1);
    }
    
    console.log('✅ Database connection successful!');
    console.log(`   Test query returned: ${data ? data.length : 0} rows\n`);
    
    console.log('📦 Testing storage connection...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.warn('⚠️  Storage connection failed (this is OK if bucket doesn\'t exist yet)');
      console.warn(`   Error: ${bucketsError.message}`);
    } else {
      console.log('✅ Storage connection successful!');
      console.log(`   Found ${buckets?.length || 0} buckets`);
      
      const toolsBucket = buckets?.find(b => b.name === 'tools');
      if (toolsBucket) {
        console.log('✅ "tools" bucket exists');
      } else {
        console.log('⚠️  "tools" bucket not found (will be created)');
      }
    }
    
    console.log('\n✅ All tests passed! Supabase connection is working.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection test failed!');
    console.error(`   Error: ${error.message}`);
    console.error(`   Type: ${error.constructor.name}`);
    console.error('\n💡 Possible causes:');
    console.error('   1. Network connectivity issue');
    console.error('   2. Incorrect Supabase URL');
    console.error('   3. Invalid service role key');
    console.error('   4. Firewall/proxy blocking connection');
    console.error('   5. Supabase project paused or deleted');
    process.exit(1);
  }
})();

