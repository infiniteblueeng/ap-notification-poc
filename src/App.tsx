import React, { useCallback, useEffect, useState } from 'react';
import Communications from 'pages/Communications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { hasStoredCredentials, useEverbridgeSettingsRow } from 'hooks/useEverbridgeSettingsRow';
import { ToastProvider, useToasts } from 'hooks/useToasts';

const queryClient = new QueryClient();

type AppProps = {
  isDev?: boolean;
  isStandalone?: boolean;
};

export default function App(props: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CommunicationsApp {...props} />
      </ToastProvider>
    </QueryClientProvider>
  );
}

function CommunicationsApp({ isDev, isStandalone }: AppProps) {
  const [open, setOpen] = useState(false);
  const { pushToast } = useToasts();
  const { data: settingsRow, refetch: refetchSettingsRow } = useEverbridgeSettingsRow({
    enabled: !isDev && !isStandalone,
  });

  const handleOpenCommunicationsModal = useCallback(async () => {
    if (isDev || isStandalone) {
      setOpen(true);
      return;
    }

    const result = await refetchSettingsRow();
    const nextSettingsRow = result.data ?? settingsRow ?? null;

    if (hasStoredCredentials(nextSettingsRow)) {
      setOpen(true);
      return;
    }

    pushToast({
      type: 'error',
      title: result.error ? 'Unable to verify credentials' : 'Everbridge 360 Communications has not been configured for your organization. Please contact your account administrator or Everbridge Account Manager',
      message: result.error
        ? 'We could not verify your Everbridge credentials. Update them in Integrations Configuration and try again.'
        : null,
    });
  }, [isDev, isStandalone, pushToast, refetchSettingsRow, settingsRow]);

  useEffect(() => {
    // DOM button calls this.
    window.__openCommunicationsModal = () => {
      void handleOpenCommunicationsModal();
    };
    window.__closeCommunicationsModal = () => setOpen(false);
    return () => {
      delete window.__openCommunicationsModal;
      delete window.__closeCommunicationsModal;
    };
  }, [handleOpenCommunicationsModal]);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .rbs-pageTool {
        z-index: 1 !important;
      }
      .rbs-sidebar {
        z-index: 1 !important;
      } 
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return <Communications open={open} onOpenChange={setOpen} isStandalone={isStandalone} isDev={isDev} />;
}
