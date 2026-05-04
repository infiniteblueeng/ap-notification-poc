import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLaunchComm } from 'hooks/comms/launch/useLaunchComm';
import { useCommTemplates, useCommEventTypes, useCommTemplateById } from 'hooks/comms/list';
import { params } from 'utils/consts';
import { ValidationResult } from './VariableFields/types';
import { useToasts } from 'hooks/useToasts';
import LaunchHeader from './LaunchHeader';
import EventAndTemplateCard from './EventTemplateCard';
import { PreviewMessages } from './VariableFields/PreviewMessage';
import { useCommVariables } from 'hooks/comms/launch/useCommVariables';
import LaunchActionBar from './LaunchActionBar';
import Card from 'components/Card';

type Mode = 'LIVE' | 'SIMULATION' | 'PREVIEW';

function formatTitleForEvent(eventType: string) {
  const dateStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const left = eventType && eventType.trim() ? eventType.trim() : 'Generic';
  return `${left} - ${dateStr}`;
}

const STORAGE_KEY = `launch-panel-state-${params.id}`; // per-plan key

const LaunchCommunicationPanel = ({ tokenResponse, permissions, setActiveTab }) => {
  const isDev = process.env.NODE_ENV === 'development';
  const isStandalone = params.standaloneMode;

  // Hooks
  const { pushToast } = useToasts();
  const commsTemplates = useCommTemplates({}, { token: tokenResponse, planType: params.planType, standaloneMode: params.standaloneMode });
  const commEventTypes = useCommEventTypes({ token: tokenResponse });
  const launchComm = useLaunchComm(tokenResponse);

  // Hydrate saved state from sessionStorage
  let parsed: null | Record<string, any> = null;
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
  }

  // Event type - default to saved or "General"
  const [eventType, setEventType] = useState<string>(() => parsed?.eventType ?? 'General');

  // Title
  const [title, setTitle] = useState<string>(() => {
    // If saved title exists, prefer it. Otherwise build from saved eventType or 'General'
    if (parsed?.title) return parsed.title;
    const baseEvent = parsed?.eventType ?? 'General';
    return formatTitleForEvent(baseEvent);
  });
  const [titleManuallyEdited, setTitleManuallyEdited] = useState<boolean>(() => Boolean(parsed?.titleManuallyEdited ?? false));

  // Description
  const [description, setDescription] = useState<string>(() => parsed?.description ?? '');

  // Mode - always live right now
  const mode: Mode = 'LIVE';

  // Template
  const [templateId, setTemplateId] = useState<string>(() => parsed?.templateId ?? '');

  // Variables & Validation
  const [isValidatingVariables, setIsValidatingVariables] = useState<boolean>(false);
  const [variableValidationMessages, setVariableValidationMessages] = useState<string[] | null>(null);
  const variableFieldsRef = useRef<{
    validate?: () => Promise<ValidationResult>;
    getValues?: () => Record<string, any>;
  } | null>(null);

  // Persisted variable values (string | string[] | null)
  const [valuesById, setValuesById] = useState<Record<string, string | string[] | null>>(() => parsed?.valuesById ?? {});
  const variablesQuery = useCommVariables({ tokenResponse, enabled: Boolean(templateId), pageSize: 500 });
  const variableDefs = variablesQuery?.data ?? [];

  // Confirmation state
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false);
  const isLocked = showLaunchConfirm || launchComm.isPending || isValidatingVariables;

  const templateDetailQuery = useCommTemplateById(templateId, { token: tokenResponse, enabled: Boolean(templateId) });
  const { template: templateDetail } = templateDetailQuery;
  const templateVars = templateDetail?.variables ?? [];
  const hasTemplate = Boolean(templateId);

  // template defaults by id (from templateDetail.variables)
  const templateDefaultsById = useMemo(() => {
    const map: Record<string, any> = {};
    (templateDetail?.variables ?? []).forEach((v: any) => {
      map[v.variableId] = v.value ?? null;
    });
    return map;
  }, [templateDetail?.variables]);

  // merged values (UI edits override template values)
  const mergedValuesById = useMemo(() => ({ ...templateDefaultsById, ...(valuesById ?? {}) }), [templateDefaultsById, valuesById]);

  // Clear stored state helper
  const clearStoredState = () => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const resetLaunch = () => {
    // revert to defaults
    setEventType('General');
    setTitle(formatTitleForEvent('General'));
    setTitleManuallyEdited(false);
    setTemplateId('');
    setDescription('');
    setValuesById({});
    // clear persisted storage so next mount uses defaults
    clearStoredState();
  };

  function buildLaunchBody(contextVariables?: Array<{ variableId: string; value: string | string[] }>) {
    return {
      title,
      mode,
      ...(description ? { description } : {}),
      ...(eventType ? { eventType } : {}),
      templateId: `commsTemplate://${templateId}`,
      exercise: false,
      ...(contextVariables?.length ? { context: { variables: contextVariables } } : {}),
    };
  }

  async function handleLaunch(confirm = false) {
    // Prevent double starts while already validating
    if (isValidatingVariables) return;

    if (!templateId) {
      alert('Please select a template before launching this communication.');
      return;
    }

    if (templateDetailQuery.isFetching) return;

    setIsValidatingVariables(true);
    try {
      // Only validate variables if they exist, otherwise we can launch
      const result = (await variableFieldsRef.current?.validate?.()) ?? { ok: true, contextVariables: undefined, messages: [] };

      if (!result?.ok) {
        setShowLaunchConfirm(false);
        setVariableValidationMessages(result?.messages?.length ? result.messages : ['Please fix the variables highlighted below.']);
        return;
      }

      setVariableValidationMessages(null);

      if (!confirm) {
        setShowLaunchConfirm(true);
        return;
      }

      const body = buildLaunchBody(result.contextVariables ?? undefined);
      launchComm.mutate({ body });
    } catch (err) {
      // if validation throws for any reason, show a message
      setVariableValidationMessages(['Unable to validate variables. Please try again.']);
      // optionally log/handle error
      // console.error('variable validation error', err);
    } finally {
      setIsValidatingVariables(false);
    }
  }

  // Update event type from API if it loads later (keep current if user changed it)
  useEffect(() => {
    if (!commEventTypes.isLoading && commEventTypes.rows?.length) {
      const firstName = commEventTypes.rows[0].name ?? 'General';
      setEventType((prev) => {
        // if prev is falsy ('' / null / undefined) use API; otherwise keep prev
        return prev ? prev : firstName;
      });
    }
  }, [commEventTypes.isLoading, commEventTypes.rows]);

  // Auto-title updates when eventType changes, unless manually edited
  useEffect(() => {
    if (!titleManuallyEdited) {
      setTitle(formatTitleForEvent(eventType));
    }
  }, [eventType, titleManuallyEdited]);

  // Clear validation messages and confirmation if template changes
  useEffect(() => {
    setVariableValidationMessages(null);
    setShowLaunchConfirm(false);
  }, [templateId]);

  // On launch success, reset state, clear storage and show toast
  useEffect(() => {
    if (launchComm.isSuccess && launchComm.data) {
      // clear persisted state so next open starts fresh
      clearStoredState();
      setActiveTab('list');

      pushToast({ type: 'success', title: 'Launch succeeded', message: 'Communication launched successfully.' });
    }
  }, [launchComm.isSuccess, launchComm.data, pushToast, eventType]);

  // On launch error, show toast with message extraction
  useEffect(() => {
    if (launchComm.isError) {
      let msg = 'Launch failed.';
      try {
        const err = launchComm.error as any;
        if (err?.message) msg = err.message;
        else if (err?.toString) msg = String(err);
      } catch {}
      pushToast({ type: 'error', title: 'Launch failed', message: msg });
    }
  }, [launchComm.isError, launchComm.error, pushToast]);

  // Update valuesById either from live fields or template defaults when template changes
  useEffect(() => {
    try {
      const live = variableFieldsRef.current?.getValues?.() ?? {};
      if (live && Object.keys(live).length) {
        setValuesById(live);
      } else {
        setValuesById((prev) => ({ ...templateDefaultsById, ...prev }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, templateDetail?.variables, templateDefaultsById]);

  // Persist relevant state to sessionStorage on changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload = JSON.stringify({
        eventType,
        title,
        titleManuallyEdited,
        description,
        templateId,
        valuesById,
      });
      sessionStorage.setItem(STORAGE_KEY, payload);
    } catch {
      // ignore storage errors
    }
  }, [eventType, title, titleManuallyEdited, description, templateId, valuesById]);

  // Don't show the launch panel at all if the user doesn't have launch permissions
  if (!permissions?.includes('bc.comms.launch')) return null;

  return (
    <div className="w-full px-2 pb-24">
      <LaunchHeader
        title={title}
        description={description}
        onSaveTitle={(nextTitle: string) => {
          setTitle(nextTitle);
          setTitleManuallyEdited(true);
        }}
        onSaveDescription={(nextDescription: string) => setDescription(nextDescription)}
      />

      <div className="flex flex-col gap-6">
        <EventAndTemplateCard
          eventType={eventType}
          setEventType={(v: string) => setEventType(v)}
          templateId={templateId}
          setTemplateId={(id: string) => setTemplateId(id)}
          commEventTypes={commEventTypes}
          commsTemplates={commsTemplates}
          isLocked={isLocked}
          hasTemplate={hasTemplate}
          templateDetail={templateDetail}
          templateVars={templateVars}
          variableFieldsRef={variableFieldsRef}
          tokenResponse={tokenResponse}
          onVariablesChange={(next: Record<string, string | string[] | null>) => {
            setValuesById(next);
          }}
          resetLaunch={() => {
            // user clicked "reset" inside the card
            resetLaunch();
          }}
        />

        {!hasTemplate && <div className="mt-4 rounded-xl px-6 py-6 text-center text-base text-zinc-800">Please select a template to proceed</div>}

        {variableValidationMessages?.length ? (
          <div className="rounded-xl bg-red-50 ring-1 ring-red-200 p-3">
            <div className="text-sm font-medium text-red-800">Please fix the following:</div>
            <ul className="mt-2 list-disc pl-5 text-xs text-red-800 space-y-1">
              {variableValidationMessages.map((m, idx) => (
                <li key={idx}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasTemplate ? (
          <Card>
            <PreviewMessages contents={templateDetail?.message?.contents ?? []} variables={variableDefs} valuesById={mergedValuesById} defaultOpen={{ Email: true, SMS: false, Voice: false }} />
          </Card>
        ) : null}
      </div>

      {hasTemplate && (
        <LaunchActionBar
          disabled={launchComm.isPending || !title || !templateId || templateDetailQuery.isFetching}
          isConfirming={showLaunchConfirm}
          subtitle="Gathering recipients"
          onCancel={() => {
            if (isDev || isStandalone) {
              // reset locally and clear persisted state
              resetLaunch();
            } else {
              // close modal, but make sure to clear storage so next open is fresh
              clearStoredState();
              window.__closeCommunicationsModal?.();
            }
            setShowLaunchConfirm(false);
          }}
          onStartLaunch={() => handleLaunch(false)}
          onStopLaunch={() => setShowLaunchConfirm(false)}
          onLaunchImmediately={() => {
            setShowLaunchConfirm(false);
            handleLaunch(true);
          }}
          onAutoLaunch={() => {
            setShowLaunchConfirm(false);
            handleLaunch(true);
          }}
        />
      )}
    </div>
  );
};

export default LaunchCommunicationPanel;
