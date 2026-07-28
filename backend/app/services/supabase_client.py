from supabase import create_client, Client
from app.config import settings

# Service-role key bypasses RLS - only ever used server-side, never expose to frontend
supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)
