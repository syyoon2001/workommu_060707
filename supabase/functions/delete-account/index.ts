import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: '인증 토큰이 없습니다.' }, 401);
  }
  const token = authHeader.replace('Bearer ', '');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !user) {
    return json({ error: '유효하지 않은 인증입니다.' }, 401);
  }

  // profiles 삭제 시 info_posts/help_requests/help_responses/help_history/
  // safety_reports 등 연관 데이터가 FK CASCADE로 함께 삭제된다.
  const { error: profileError } = await adminClient
    .from('profiles')
    .delete()
    .eq('id', user.id);

  if (profileError) {
    return json({ error: profileError.message }, 500);
  }

  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (authDeleteError) {
    return json({ error: authDeleteError.message }, 500);
  }

  return json({ success: true });
});
