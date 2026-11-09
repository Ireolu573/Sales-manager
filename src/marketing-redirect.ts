import { supabase } from '@/integrations/supabase/client'

// Keep the supplied marketing website public at "/". Only visitors with an
// active Supabase session should be sent straight into the application.
async function redirectSignedInVisitors() {
  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) throw error

    if (data.session?.user) {
      window.location.replace('/app')
      return
    }
  } catch (error) {
    // If session restoration fails, keep the public website accessible.
    console.error('Unable to restore authentication session:', error)
  }

  document.documentElement.style.visibility = 'visible'
}

void redirectSignedInVisitors()
