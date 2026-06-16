import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { params } from 'utils/consts';
import { useSetCommActive } from 'hooks/comms/launch/useStopComm';
import getCommColumns from './ListComms/commColumns';
import type { Comm } from 'hooks/comms/list/useComms';

import { CommDetailView } from './CommDetail/CommsDetailView';
import LaunchCommunicationPanel from './LaunchComm/LaunchCommunicationPanel';
import CommunicationsListPanel from './ListComms/CommunicationsListPanel';
import CommsSettingsPanel from './Settings/CommSettingsPanel';
import { useToasts } from 'hooks/useToasts';
import { ShieldAlert } from 'lucide-react';

type TabKey = 'launch' | 'list' | 'settings';

type CommsTabProps = {
  tokenResponse: any;
  permissions?: string[];
  permissionsLoading?: boolean;
  permissionsError?: unknown;
};

type AuthenticatedCommsTabProps = {
  tokenResponse: any;
  permissions?: string[];
  canLaunch: boolean;
  canList: boolean;
  showSettings: boolean;
};

const TabButton = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className={['relative ml-2 mr-4 pb-3 text-sm font-semibold', active ? 'text-blue-700' : 'text-zinc-700 hover:text-zinc-900'].join(' ')}>
    {children}
    <span className={['absolute left-0 right-0 -bottom-px h-[2px] rounded-full', active ? 'bg-blue-600' : 'bg-transparent'].join(' ')} />
  </button>
);

const AccessState = ({ title, message }: { title: string; message: string }) => (
  <div className="flex min-h-[220px] w-full items-center justify-center px-4 py-12 text-center">
    <div className="max-w-lg rounded-xl bg-white/80 px-8 py-7 shadow-[0_8px_24px_rgba(14,30,37,0.06)] ring-1 ring-zinc-100">
      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
        <ShieldAlert className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{message}</p>
    </div>
  </div>
);

function CommsTabAccessFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-full">
      <div className="border-b border-zinc-200" />
      <div className="pt-6">{children}</div>
    </div>
  );
}

const CommsTab = ({ tokenResponse, permissions, permissionsLoading = false, permissionsError }: CommsTabProps) => {
  const canLaunch = permissions?.includes('bc.comms.launch');
  const canList = permissions?.includes('bc.comms.list');
  const showSettings = params?.showSettings;
  const hasAnyPermission = !!canLaunch || !!canList;

  if (permissionsLoading) {
    return (
      <CommsTabAccessFrame>
        <AccessState title="Checking access" message="We are verifying whether you can launch or view communications." />
      </CommsTabAccessFrame>
    );
  }

  if (permissionsError) {
    return (
      <CommsTabAccessFrame>
        <AccessState title="Unable to verify access" message="We could not confirm your communication permissions. Please refresh the page or contact your administrator." />
      </CommsTabAccessFrame>
    );
  }

  if (!hasAnyPermission) {
    return (
      <CommsTabAccessFrame>
        <AccessState title="Not authorized" message="You do not have permission to launch or view communications. Please contact your administrator if you need access." />
      </CommsTabAccessFrame>
    );
  }

  return <AuthenticatedCommsTab tokenResponse={tokenResponse} permissions={permissions} canLaunch={!!canLaunch} canList={!!canList} showSettings={!!showSettings} />;
};

const AuthenticatedCommsTab = ({ tokenResponse, permissions, canLaunch, canList, showSettings }: AuthenticatedCommsTabProps) => {
  const isDev = process.env.NODE_ENV === 'development';
  const isStandalone = params.standaloneMode;
  const showListView = isDev || isStandalone;

  console.log('Permissions: ', permissions, `CanList: ${canList}`, `CanLaunch: ${canLaunch}`);

  const { pushToast } = useToasts();

  const [activeTab, setActiveTab] = useState<TabKey>('list');

  const [selected, setSelected] = useState<{ id: string; row?: Comm | null } | null>(null);

  const stopComm = useSetCommActive(tokenResponse);

  const commColumns = useMemo<ColumnDef<Comm>[]>(() => {
    return getCommColumns();
  }, [stopComm, permissions]);

  useEffect(() => {
    setActiveTab(canLaunch ? 'launch' : 'list');
  }, [canLaunch]);

  if (selected) {
    const setCommActive = (id, active) => stopComm.mutate({ commId: id, active: active === true ? false : true });
    return (
      <CommDetailView
        commId={selected.id}
        token={tokenResponse}
        onBack={() => {
          setActiveTab('list');
          setSelected(null);
        }}
        onCommActive={setCommActive}
      />
    );
  }

  return (
    <div className="w-full h-full">
      <div className="border-b border-zinc-200">
        <div className="flex items-center gap-2">
          {canLaunch && (
            <TabButton active={activeTab === 'launch'} onClick={() => setActiveTab('launch')}>
              Launch Communication
            </TabButton>
          )}
          {canList && (
            <TabButton active={activeTab === 'list'} onClick={() => setActiveTab('list')}>
              Communication List
            </TabButton>
          )}
          {canLaunch && showSettings && (
            <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
              Settings
            </TabButton>
          )}
        </div>
      </div>

      <div className="pt-6">
        {activeTab === 'launch' && canLaunch ? <LaunchCommunicationPanel tokenResponse={tokenResponse} permissions={permissions} setActiveTab={setActiveTab} /> : null}

        {activeTab === 'list' && canList ? (
          <CommunicationsListPanel tokenResponse={tokenResponse} permissions={permissions} columns={commColumns} showListView={showListView} onRowPress={setSelected} setActiveTab={setActiveTab} />
        ) : null}

        {activeTab === 'settings' && canLaunch ? (
          <CommsSettingsPanel
            pushToast={pushToast}
            onSaved={() => {
              if (canLaunch) setActiveTab('launch');
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

export default CommsTab;
