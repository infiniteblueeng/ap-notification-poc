import React, { useEffect } from 'react';
import { Modal } from 'components/Modal';
import CommsTabShell from 'components/Communications/CommsTabShell';
import { useEverbridgeToken } from 'hooks/useEverbridgeToken';
import { useToasts } from 'hooks/useToasts';
import { useValidPermissions } from 'hooks/useValidPermissions';
import HeaderBar from 'components/HeaderBar';

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isStandalone?: boolean;
  isDev?: boolean;
};

export default function Communications({ open, onOpenChange, isStandalone, isDev }: Props) {
  if (isStandalone)
    return (
      <>
        <CommunicationsContent isDev={isDev} isStandalone={isStandalone} />
      </>
    );

  if (isDev)
    return (
      <>
        <HeaderBar onClose={() => onOpenChange(false)} />
        <CommunicationsContent isDev={isDev} isStandalone={isStandalone} />
      </>
    );

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} title="Communications">
      <HeaderBar onClose={() => onOpenChange(false)} />
      <CommunicationsContent />
    </Modal>
  );
}

function CommunicationsContent({ isDev, isStandalone }: { isDev?: boolean; isStandalone?: boolean }) {
  const { pushToast } = useToasts();
  const { permissions, isLoading: permissionsLoading, error: permissionsError } = useValidPermissions();
  const hasCommunicationAccess = permissions.includes('bc.comms.launch') || permissions.includes('bc.comms.list');
  const tokenQuery = useEverbridgeToken({
    pushToast,
    isDev,
    enabled: !permissionsLoading && hasCommunicationAccess,
  });

  useEffect(() => {
    if (tokenQuery.isError) {
      console.error('Error fetching Everbridge token:', tokenQuery.error);
      pushToast({
        title: 'Error verifying credentials with Everbridge',
        message: 'Please verify your credentials in settings, and make sure you have established the necessary custom method in the platform (see documentation).',
        type: 'error',
      });
    }
  }, [tokenQuery.isError, tokenQuery.error, pushToast]);

  return (
    <div
      className={`overflow-auto ${isStandalone ? 'p-6 ' : 'p-10 '} h-full bg-[linear-gradient(146deg,rgba(224,237,255,0.41)_26.27%,rgba(218,217,255,0.50)_37.44%,rgba(224,235,255,0.41)_61.17%,rgba(233,240,255,0.50)_84.9%)] relative w-full`}
      style={isStandalone ? { minHeight: 'var(--eb-comms-standalone-min-height, calc(100vh - 8.25rem))' } : undefined}>
      <div className="relative w-full h-full">
        <div className="flex-1 min-h-0 space-y-4 h-full">
          <CommsTabShell tokenResponse={tokenQuery} permissions={permissions} permissionsLoading={permissionsLoading} permissionsError={permissionsError} />
        </div>
      </div>
    </div>
  );
}
