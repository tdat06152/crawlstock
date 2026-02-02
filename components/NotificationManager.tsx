'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Alert } from '@/lib/types';

export default function NotificationManager() {
    const [lastChecked, setLastChecked] = useState<Date>(new Date());
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const supabase = createClient();

    useEffect(() => {
        // Request notification permission on mount
        if ('Notification' in window) {
            setPermission(Notification.permission);

            if (Notification.permission === 'default') {
                Notification.requestPermission().then(perm => {
                    setPermission(perm);
                });
            }
        }

        // Poll for new alerts every 45 seconds
        const interval = setInterval(checkForNewAlerts, 45000);

        return () => clearInterval(interval);
    }, []);

    const checkForNewAlerts = async () => {
        try {
            const { data: user } = await supabase.auth.getUser();
            if (!user.user) return;

            const { data: alerts, error } = await supabase
                .from('alerts')
                .select('*')
                .eq('user_id', user.user.id)
                .gt('triggered_at', lastChecked.toISOString())
                .order('triggered_at', { ascending: false });

            if (error) {
                console.error('Error fetching alerts:', error);
                return;
            }

            if (alerts && alerts.length > 0) {
                alerts.forEach((alert: Alert) => {
                    showNotification(alert);
                });
                setLastChecked(new Date());
            }
        } catch (error) {
            console.error('Error checking alerts:', error);
        }
    };

    const showNotification = (alert: Alert) => {
        if (permission === 'granted' && 'Notification' in window) {
            new Notification('Stock Alert', {
                body: alert.reason,
                icon: '/favicon.ico',
                tag: alert.id,
                requireInteraction: false
            });
        }
    };

    return null; // This component doesn't render anything
}
