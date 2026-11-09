import { supabase } from '@/integrations/supabase/client'

// The root URL is the app entry point. Resolve the saved Supabase session
// before showing the public marketing page, then send the visitor to the
// correct destination.
async function redirectFromRoot() {
  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) throw error

    window.location.replace(data.session?.user ? '/app' : '/login')
  } catch (error) {
    console.error('Unable to restore authentication session:', error)
    window.location.replace('/login')
  }
}

void redirectFromRoot()
