
'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';

export default function NotificationManager() {
    const supabase = createClient();

    useEffect(() => {
        // Poll for new alerts or subscribe to realtime?
        // For now, let's just log or setup subscription if needed.
        // Realtime subscription to 'alerts' table for current user

        // Logic: check permission
        // Not critical for 'Market Scan Add-on' MVP unless requested "Realtime Push".
        // User requested "Gửi thông báo (in-app trước)".

        // We can just query unread alerts every minute.

        const checkAlerts = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('alerts')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_sent', false);

            if (data && data.length > 0) {
                // Show browser notification or toast
                // console.log("New alerts:", data.length);

                // Mark as sent?
                // Usually we mark as 'read' when user views them. 'is_sent' implies pushed to user.
            }
        };

        const interval = setInterval(checkAlerts, 60000);
        return () => clearInterval(interval);
    }, []);

    return null; // Headless component
}
